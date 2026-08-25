# Orquestador agentico — cerebro del chatbot

Arquitectura de producto: **Agentic RAG** sobre NestJS. El orquestador decide, por cada mensaje entrante, si avanza el guion, consulta el catálogo Prisma, ejecuta el pipeline RAG o hace handoff a humano.

No es un agente autónomo multi-día ni un negociador libre de descuentos.

## 1. Objetivo

Maximizar respuestas **precisas y auditables** en el ramo de eventos sociales, con:

- 0% de montos inventados (datos duros = tools).
- Documentación narrativa con hybrid search + rerank + citas.
- Escalación automática ante baja confianza.

## 2. Módulos conceptuales NestJS

| Módulo | Responsabilidad |
|---|---|
| `ChannelsModule` | Webhooks Meta/Twilio, normalización de mensaje, envío saliente |
| `ConversationOrchestratorModule` | Router de intents / políticas de turno; llama a tools o RAG |
| `ScriptModule` | Guion de precalificación (máquina de estados o flujo aprobado) |
| `ToolsCatalogModule` | Function calling → Prisma (paquetes, precios, inclusiones, reglas) |
| `RagPipelineModule` | Hybrid search + rerank + LLM estricto |
| `HandoffModule` | Estado `escalado`, notificación, pausa de bot |
| `KnowledgeIngestionModule` | Publicar/archivar docs, invalidación, jobs de índice; MediaRouter multimodal |
| `CrmModule` | Lead, oportunidad, brief, calificación |
| `AssignmentModule` | Reglas de asignación |
| `QuotaModule` | Contadores de mensajería y uso de IA |
| `AuditModule` | Timeline operativo + emisión de `EventoOperativo` |
| Proveedores IA (ports) | OpenAI (LLM/embeddings/Vision/Whisper) + Cohere Rerank — [07-pipeline-openai-y-proveedores.md](07-pipeline-openai-y-proveedores.md) |

## 3. Flujo por mensaje

```
MensajeProspecto (± adjuntos)
      ↓
¿Bot activo en el hilo? ──no──► Solo registrar (humano controla)
      │ sí
      ↓
¿Pedido de humano / conflicto / toxicidad? ──sí──► Handoff
      │ no
      ↓
¿Hay adjuntos? ──sí──► Validar MIME/límites + encolar MediaRouter (§4.6)
      │
¿Turno de captura del guion? ──sí──► ScriptModule (sin RAG; adjunto async si aplica)
      │ no
      ↓
Clasificar intención (LLM ligero o reglas + LLM)
      ├─ datos_duros / cotización / paquete / precio / inclusiones
      │         ↓
      │   Gate no_recuperable_precio (§4.5): ignorar montos OCR/RAG
      │   ToolsCatalogModule (Prisma)
      │         ↓
      │   ¿Filas vigentes? ──no──► Safe + Handoff
      │         │ sí
      │         ▼
      │   Redactar respuesta con datos de tool (sin inventar)
      │   RegistroConsultaCatalogo + actualizar brief
      │
      └─ pregunta_documental / política / FAQ / ficha
                ↓
          RagPipelineModule (incluye fragmentos derivados foto/video si publicados)
                ↓
          ¿Rerank ≥ 0.85 y cita posible? ──no──► Safe + Handoff
                │ sí
                ▼
          Respuesta anclada + [Fuente: archivo | tipo: material] (§5.1)
          RegistroRecuperacion
      ↓
Evaluar calificación / listo_para_cotizar
Contabilizar cupo (mensajería + tokens IA)
Enviar por canal de origen
```

## 4. Políticas de routing (decisiones duras)

### 4.1 Siempre guion (sin RAG ni tools de precio)

- Saludo inicial, pedir nombre, ocasión, fecha, aforo, sede, presupuesto, confirmación de intención.
- Validaciones de formato (número de invitados, fecha razonable).

### 4.2 Siempre tools de catálogo

Cualquier mención de:

- Precio, costo, “cuánto sale”, paquetes, “qué incluye”, comparación de paquetes, menú infantil **si** está modelado como inclusión/precio, anticipo mínimo catalogado.

**Prohibido** responder estas intenciones solo con fragmentos vectoriales.

### 4.3 Siempre RAG documental

- Ubicación, cómo llegar, descripción del venue, políticas conversacionales, tipos de evento en prosa, límites del bot, safe copy institucional.

### 4.4 Siempre handoff

- Lead pide humano.
- Rerank &lt; 0.85 en todos los candidatos.
- Tool sin filas vigentes.
- LLM no puede citar fuente en rama RAG.
- Objeción legal, queja, fechas “bloqueadas”, descuento fuera de catálogo.
- Ambigüedad de sede cuando Jardín 2 no está operativo y el lead insiste en otra ubicación no cubierta.
- Adjunto no soportado / video &gt; 5 min / fallo Vision–Whisper cuando el turno depende de ese media.
- Cupo IA hard limit (si está pactado) — ver [07-pipeline-openai-y-proveedores.md](07-pipeline-openai-y-proveedores.md) §8.

### 4.5 Gate `no_recuperable_precio` (anti-cotización desde OCR/RAG)

Los fragmentos (texto nativo o **derivados** de Vision/Whisper) pueden llevar `no_recuperable_precio = true` cuando la ingesta detectó tarifas/OCR de montos ([08-ingesta-multimodal.md](08-ingesta-multimodal.md) §6, [03-rag-avanzado.md](03-rag-avanzado.md) §6).

| Condición | Acción del orquestador |
|---|---|
| Intención = precio / paquete / inclusiones / “cuánto sale” | **Siempre** `ToolsCatalogModule` (Prisma). Ignorar montos en cualquier fragmento o texto derivado |
| Rama RAG recupera solo fragmentos con el flag y la pregunta es monetaria | No redactar cifra desde contexto → tools si aplica; si no hay fila → safe + handoff (`sin_catalogo` o `material_ocr_tarifas`) |
| Rama RAG recupera fragmentos con flag pero la pregunta es narrativa (ambiente, ubicación) | Permitir prosa **sin** emitir montos; el generador tiene prohibido copiar números de tarifa del contexto |
| Adjunto de canal con tarifas visibles | Scrub; no cotizar; ofrecer catálogo vía tools o handoff |

**Prohibido:** usar OCR, Vision, Whisper o RAG como fuente de verdad de precios. El flag es la señal dura; la intención monetaria es el segundo candado.

### 4.6 Adjuntos entrantes (canal)

Cuando el mensaje trae media (foto, video, documento):

```
Mensaje + adjunto(s)
      ↓
¿MIME / tamaño / duración OK? ──no──► Safe + handoff (adjunto_no_soportado)
      │ sí
      ↓
put ObjectStorage + encolar MediaRouter (async)
      ↓
¿Guion bloqueante por el adjunto? ──no──► Seguir guion / routing de texto del mensaje
      │ sí (lead: “¿está bien este croquis?” / “cotiza con esta foto”)
      ↓
Esperar texto derivado (SLA foto &lt; 90 s / video &lt; 5 min) o handoff si timeout
      ↓
Aplicar §4.2–4.5 sobre texto del mensaje + texto derivado
      (montos → tools; narrativa → RAG; flag precio → no cotizar desde media)
```

Reglas:

- El adjunto de canal **no** se publica solo a la biblioteca K.
- El bot no “lee” el binario en el hilo síncrono del webhook; usa el resultado del job.
- Detalle de allowlist y estados: [08-ingesta-multimodal.md](08-ingesta-multimodal.md).

## 5. Function calling — contrato con el LLM orquestador

El modelo orquestador (puede ser el mismo proveedor que el generador) solo puede invocar tools registradas:

- `buscar_paquetes`
- `obtener_precio_paquete`
- `listar_inclusiones`
- `comparar_paquetes`
- `evaluar_reglas_paquete`
- `transferir_a_humano` (handoff explícito)

No hay tool genérica `ejecutar_sql`. Prisma encapsula consultas parametrizadas en el servicio de tools.

Tras tool result, la redacción al lead:

- Usa **únicamente** campos devueltos.
- Incluye SKU/nombre de paquete cuando hay precio.
- Si el result trae `sin_precio_vigente` → no reintenta “estimar”.
- No mezcla montos de tool con números vistos en adjuntos u OCR.

### 5.1 Citas con tipo de material (rama RAG)

Toda respuesta RAG exitosa termina con cita que incluye el **tipo de material** del fragmento usado (metadato de ingesta):

| `tipo_material` | Ejemplo de cita |
|---|---|
| `pdf` / `word` / `faq` | `[Fuente: ficha-jardin-1.pdf \| tipo: pdf]` |
| `foto` | `[Fuente: salon-principal.jpg \| tipo: foto]` |
| `video` | `[Fuente: recorrido-salon.mp4 \| tipo: video]` |
| `narrativa` (texto panel) | `[Fuente: FAQ general \| tipo: faq]` |

Reglas:

- Si el modelo omite la cita o el tipo → tratar como fallo y handoff (igual que sin fuente).
- Si hubo varios fragmentos, citar el principal (o los acordados en prompt); no citar adjuntos de canal como si fueran inventario K.
- Fragmentos con `no_recuperable_precio` pueden citarse solo en respuestas **no monetarias**; jamás como respaldo de un monto.

## 6. Estado conversacional

Persistir por conversación/oportunidad:

| Campo | Uso |
|---|---|
| `paso_guion` | Dónde va la captura |
| `campos_capturados` | Nombre, ocasión, fecha, aforo, etc. |
| `paquete_tentativo_id` | SKU sugerido |
| `ultima_ruta` | guion \| catalogo \| rag \| handoff \| safe |
| `estado_bot` | activo \| escalado \| humano |

## 7. Handoff hacia el panel Next.js

Al invocar handoff:

1. `Conversacion.estado_bot = escalado` (+ timestamp).
2. Bot deja de responder ese hilo.
3. Notificación prioritaria (panel ± email) con SLA 15–30 min.
4. Mensaje safe al lead (copy K09 aprobado).
5. Expediente muestra motivo de escalación (`rerank_bajo` | `sin_catalogo` | `solicitud_usuario` | `conflicto` | `adjunto_no_soportado` | `material_ocr_tarifas` | `proveedor_ia` | `cupo_ia` | otro).

## 8. Telemetría operativa del bot

Por cada mensaje saliente del bot o decisión de routing, persistir `EventoOperativo` (actor `bot`) con:

| Campo | Obligatorio |
|---|---|
| `ruta` (`guion` \| `catalogo` \| `rag` \| `handoff` \| `safe`) | Sí |
| Tools llamadas + latencia | Si hubo tools |
| Scores de rerank | Si hubo RAG |
| IDs de fragmentos o filas de catálogo | Si hubo RAG/tools |
| Tokens / unidades de cupo estimadas | Sí |
| Motivo de handoff | Si `ruta = handoff` |
| `paso_guion` | Si aplica |
| Resultado calificación / `listo_para_cotizar` | Si se evaluó |

Vínculos: `Mensaje`, `Conversacion`/`Oportunidad`, y cuando aplique `RegistroRecuperacion` / `RegistroConsultaCatalogo`.

La telemetría del **agente humano** (toma de control, latencia SLA, reasignación, etc.) la emiten CRM / Assignment / panel; el orquestador solo deja de responder cuando `estado_bot ≠ activo`. Contrato completo: [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) §7.

## 9. Límites explícitos del producto

| Incluido | Excluido |
|---|---|
| Agentic RAG acotado por mensaje | Agente que agenda seguimientos multi-día solo |
| Tools de catálogo | SQL libre / browser tools |
| Handoff a asesores | Cierre de venta autónomo |
| Brief de cotización | Emisión automática de PDF contractual |
| Adjuntos canal + biblioteca multimodal (vía jobs) | Cotizar desde OCR/Vision/Whisper/RAG |
| SDK oficial OpenAI + Cohere Rerank | Vercel AI SDK, OpenAI Assistants API |

## 10. Criterio de cierre de este entregable

Flujo de decisión, módulos NestJS conceptuales, políticas de routing (incl. gate `no_recuperable_precio` y adjuntos), contrato de tools, citas con tipo de material y handoff documentados como cerebro único Meta/WhatsApp. Proveedores: [07-pipeline-openai-y-proveedores.md](07-pipeline-openai-y-proveedores.md); media: [08-ingesta-multimodal.md](08-ingesta-multimodal.md).
