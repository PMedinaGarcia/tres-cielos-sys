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
| `KnowledgeIngestionModule` | Publicar/archivar docs, invalidación, jobs de índice |
| `CrmModule` | Lead, oportunidad, brief, calificación |
| `AssignmentModule` | Reglas de asignación |
| `QuotaModule` | Contadores de mensajería y uso de IA |
| `AuditModule` | Timeline operativo + emisión de `EventoOperativo` |

## 3. Flujo por mensaje

```
MensajeProspecto
      ↓
¿Bot activo en el hilo? ──no──► Solo registrar (humano controla)
      │ sí
      ↓
¿Pedido de humano / conflicto / toxicidad? ──sí──► Handoff
      │ no
      ↓
¿Turno de captura del guion? ──sí──► ScriptModule (sin RAG)
      │ no
      ↓
Clasificar intención (LLM ligero o reglas + LLM)
      ├─ datos_duros / cotización / paquete / precio / inclusiones
      │         ↓
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
          RagPipelineModule
                ↓
          ¿Rerank ≥ 0.85 y cita posible? ──no──► Safe + Handoff
                │ sí
                ▼
          Respuesta anclada + [Fuente: archivo]
          RegistroRecuperacion
      ↓
Evaluar calificación / listo_para_cotizar
Contabilizar cupo
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
5. Expediente muestra motivo de escalación (`rerank_bajo` | `sin_catalogo` | `solicitud_usuario` | `conflicto` | otro).

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

## 10. Criterio de cierre de este entregable

Flujo de decisión, módulos NestJS conceptuales, políticas de routing, contrato de tools y handoff documentados como cerebro único Meta/WhatsApp.
