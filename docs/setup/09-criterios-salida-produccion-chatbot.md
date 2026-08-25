# Criterios de salida a producción — chatbot Agentic RAG

Gate **go-live del chatbot** (Agentic RAG multimodal) para Event Master System / Tres Cielos. Complementa el DoD de producto genérico en [04-criterios-de-exito.md](04-criterios-de-exito.md) y las fases G1–G11 en [../producto/02-fases-golive.md](../producto/02-fases-golive.md): aquí el foco es **qué debe estar en verde para encender el bot en prod**, no solo el panel CRM.

**No sustituye:** UAT de panel/roles (F1–F7), capacitación, ni anti-alcance comercial. **Sí bloquea** tráfico real de prospectos al orquestador si falla este gate.

**Dependencias de contrato**

| Área | Docs a usar |
|---|---|
| Plan ejecución backend chatbot | [../backend/10-plan-implementacion-chatbot.md](../backend/10-plan-implementacion-chatbot.md) |
| Plan UI chatbot / conversación | [../frontend/09-plan-implementacion-chatbot-ui.md](../frontend/09-plan-implementacion-chatbot-ui.md) |
| Orquestador / routing | [../backend/02-orquestador-agentico.md](../backend/02-orquestador-agentico.md) |
| Pipeline OpenAI + Cohere | [../backend/07-pipeline-openai-y-proveedores.md](../backend/07-pipeline-openai-y-proveedores.md) |
| Ingesta multimodal | [../backend/08-ingesta-multimodal.md](../backend/08-ingesta-multimodal.md) |
| Aceptación D-MED / T-MED | [../backend/09-aceptacion-y-matriz-tests.md](../backend/09-aceptacion-y-matriz-tests.md) |
| Cableado panel conocimiento | [../frontend/08-cableado-conocimiento-multimodal.md](../frontend/08-cableado-conocimiento-multimodal.md) |
| Infra chatbot | [../infrastructure/02-plan-implementacion-chatbot-infra.md](../infrastructure/02-plan-implementacion-chatbot-infra.md) |
| Cotización C1–C7 | [../producto/03-criterios-exito-cotizacion.md](../producto/03-criterios-exito-cotizacion.md) |
| Telemetría F7 | [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) |

---

## 1. Qué significa “salir a prod” para el chatbot

El chatbot está **autorizado a producción** cuando, en el entorno **prod** (Jardín 1):

1. Un mensaje real (o UAT prod-like firmado) en los canales del corte pasa por el **mismo cerebro** Agentic RAG.
2. **C3 = 0** montos inventados; **C5** handoff si rerank &lt; 0.85 o sin filas; **C4** frescura &lt; 60 s tras publicar.
3. Familias **D-BOT-*** y **D-MED-*** críticas en verde (tablas §2).
4. Canales del corte (FB/IG y WA si aplica) con firma webhook y cupo contabilizado.
5. Telemetría bot (`EventoOperativo`) consultable (F7).
6. Cupo **1 000 msgs/mes** visible y enforceable.
7. Kill switch / rollback probado (§6).
8. Ningún criterio de **NO-GO** (§8) activo.

El panel puede estar “usable” (DoD panel) y el bot **aún no** estar autorizado — ver §7.

---

## 2. Gate go-live chatbot — criterios Must

### 2.1 Precisión y frescura (C3 / C5 / C4)

| ID | Criterio | Umbral | Evidencia firmable |
|---|---|---|---|
| **C3** | Ninguna respuesta bot con monto que no venga de `PaquetePrecio` vigente (tools Prisma) | **0** incidentes en muestra UAT + golden tariff | Transcripts + `RegistroConsultaCatalogo`; T-MED-OCR/PDF |
| **C5** | Rerank &lt; **0.85** o tool sin fila → safe + handoff + alerta; **sin** inventar | 100 % casos tipados | Logs score + `motivoHandoff` + alerta panel |
| **C4** | Tras publicar/archivar documento o precio, la **siguiente** pregunta refleja la versión nueva | **&lt; 60 s** | Caso UAT fechado (G9); D-MED-14 / T-MED-FRESH |

Sin C3+C5+C4 en verde → **NO go-live bot** (aunque G1–G6 de CRM estén OK).

### 2.2 Dominio bot (D-BOT-*) — subset gate

Fuente completa: [04-criterios-de-exito.md](04-criterios-de-exito.md) §3.2. Para salida a prod del bot, Must:

| ID | Condición | Gate prod |
|---|---|---|
| D-BOT-1 | Routing: guion → handoff forzado → catálogo → RAG → safe; precio nunca vía RAG “porque el PDF lo decía” | Must |
| D-BOT-2 | Precio/paquete/inclusiones solo tools Prisma (C3) | Must |
| D-BOT-3 | FAQ solo fragmentos rerank ≥ 0.85 con cita | Must |
| D-BOT-4 | Rerank bajo / sin filas → safe + handoff | Must |
| D-BOT-5 | Pedido humano / queja → `escalado` + alerta | Must |
| D-BOT-6 | Tomar control → bot deja de responder | Must |
| D-BOT-7 | Devolver a bot deshabilitado por default (409) salvo política firmada | Must |
| D-BOT-8 | Cada mensaje bot emite `EventoOperativo` (ruta, tools/RAG, cupo) | Must |
| D-BOT-9 | Guion captura obligatorios (C1 ≥ 80 % UAT) | Must UAT |

### 2.3 Media / pipeline (D-MED-*) — subset gate

Fuente: [../backend/09-aceptacion-y-matriz-tests.md](../backend/09-aceptacion-y-matriz-tests.md). Si el corte de go-live incluye biblioteca multimodal (DoD-13), Must:

| ID | Condición | Gate |
|---|---|---|
| D-MED-1/2/12 | Allowlist MIME + magic bytes + límites tamaño | Must |
| D-MED-3 | `StoragePort` obligatorio; sin storage → **NO-GO** | Must |
| D-MED-4 | Estados job visibles hasta `listo`/`error` | Must |
| D-MED-5/6/7/10 | Scrub tarifas + split XLS + OCR gate (C3) | Must |
| D-MED-8 | Vision para foto (mock CI / `@live` staging) | Must si hay fotos en K |
| D-MED-9 | ffmpeg + Transcription; video ≤ **5 min** política infra | Must si hay video en K |
| D-MED-11 | Adjunto lead ≠ publicar K global | Must |
| D-MED-13 | Fallo Vision/Whisper/S3 → `error` actionable | Must |
| D-MED-14 | Frescura post-`listo` &lt; 60 s | Must (= C4 media) |

Si el corte **excluye** foto/video por omisión firmada, documentar excepción; PDF/Word/XLS + storage siguen Must para DoD-13 reducido.

### 2.4 Canales

| Canal | Condición go-live | Evidencia |
|---|---|---|
| **Facebook** | Webhook firmado; msg prueba → conversación + respuesta bot coherente | UAT §3.1 + acta |
| **Instagram** | Idem | Idem |
| **WhatsApp (Twilio)** | Mismo cerebro; plantilla utility si fuera de ventana; cupo | Si Etapa 9 en el **mismo corte**; si no, plan explícito post go-live (DoD-1) |
| Firma / URL | HTTPS prod estable; tokens **prod** ≠ staging | Config Railway + Meta/Twilio |

### 2.5 Telemetría

| ID | Condición | Evidencia |
|---|---|---|
| D-TEL-1 / F7 | Admin abre telemetría de un mensaje bot (ruta, tools, RAG, cupo, handoff) | Captura panel + fila `EventoOperativo` |
| INF-6/8 | Logs estructurados + eventos de producto | Sample ops Medina |

Sin telemetría bot auditable → **no** se puede firmar calidad post-incidente; bloquea gate.

### 2.6 Cupo

| ID | Condición | Evidencia |
|---|---|---|
| D-CUP-1 | Contador vs tope **1 000**/mes jardín activo | Vista `/cupo` o equivalente + DB |
| D-CH-6 | Unidades de mensajería incrementan por msg bot/canal | Prueba controlada |
| Config | Solo **Jardín 1** consume cupo operativo | G7 |

---

## 3. Checklist binario pre-prod

Marcar **Cumple / No cumple**. Cualquier No Must = no promover tráfico prod al bot.

### 3.1 Infra y secretos

| # | Ítem | Cumple |
|---|---|---|
| P1 | API + worker + Redis BullMQ en staging verdes ([infra/02](../infrastructure/02-plan-implementacion-chatbot-infra.md)) | ☐ |
| P2 | Postgres **pgvector** + FTS; migraciones aplicadas | ☐ |
| P3 | Object storage staging; upload K OK | ☐ |
| P4 | `OPENAI_API_KEY` + `COHERE_API_KEY` + `RERANK_THRESHOLD=0.85` | ☐ |
| P5 | Worker con **ffmpeg** si video en alcance | ☐ |
| P6 | Alertas cola &gt; 60 s y LLM/rerank fail conectadas | ☐ |
| P7 | Health/ready 200; feature flag bot off probado | ☐ |
| P8 | CI (o checklist manual equivalente firmado) con tests D-BOT/D-MED críticos verdes | ☐ |

### 3.2 Producto bot (staging UAT)

| # | Ítem | Cumple |
|---|---|---|
| P9 | C3 = 0 en muestra UAT | ☐ |
| P10 | C5 handoff verificado | ☐ |
| P11 | C4 &lt; 60 s fechado | ☐ |
| P12 | D-BOT-1…8 en verde | ☐ |
| P13 | D-MED Must del corte en verde | ☐ |
| P14 | FB + IG (y WA si aplica) UAT §3.1/3.5 | ☐ |
| P15 | F7 telemetría bot | ☐ |
| P16 | Cupo contador + solo Jardín 1 | ☐ |
| P17 | G8 conocimiento mínimo + ≥1 SKU/precio vigente | ☐ |
| P18 | Ningún NO-GO §8 | ☐ |

### 3.3 Gobernanza

| # | Ítem | Cumple |
|---|---|---|
| P19 | Secrets prod preparados en Environment `production` (nombres; no en git) | ☐ |
| P20 | Aislamiento staging↔prod (DB, bucket, keys, vectores) | ☐ |
| P21 | Runbook rollback §6 leído por on-call Medina | ☐ |
| P22 | UAT matriz §5 firmada por responsable cliente (§5.3) | ☐ |

---

## 4. Checklist binario prod (antes de abrir tráfico)

Ejecutar **después** del deploy del tag de release a prod, **antes** de apuntar webhooks de producción o de quitar el kill switch.

| # | Ítem | Cumple |
|---|---|---|
| R1 | Deploy api + worker + web prod verdes | ☐ |
| R2 | `migrate deploy` OK; extensión `vector` presente | ☐ |
| R3 | `/health` y `/health/ready` 200 | ☐ |
| R4 | Vars OpenAI/Cohere/S3/Meta/Twilio/JWT **prod** cargadas | ☐ |
| R5 | Cohere rerank responde (smoke 1 query) | ☐ |
| R6 | Storage put/get smoke | ☐ |
| R7 | Worker consume job; publish doc prueba &lt; 60 s (o ventana de mantenimiento acordada) | ☐ |
| R8 | `FF_BOT_ENABLED=false` inicialmente **o** canal solo allowlist UAT | ☐ |
| R9 | Webhook challenge Meta/Twilio OK en URL prod | ☐ |
| R10 | Mensaje canario (equipo interno) → ruta + `EventoOperativo` | ☐ |
| R11 | C3 spot-check canario (pregunta precio) → solo catálogo | ☐ |
| R12 | Cupo incrementa; Jardín 2 sin leads | ☐ |
| R13 | Kill switch off→on→off ensayado en prod (ventana corta) | ☐ |
| R14 | Backup/restore drill previo registrado (INF-5/10) | ☐ |
| R15 | Aprobación Medina + cliente para **quitar** kill switch / abrir tráfico | ☐ |

Tras R15: monitoreo intensivo 48–72 h (errores LLM, handoffs, cola, cupo).

---

## 5. UAT firmable — matriz de escenarios bot

Completar en staging (o prod-like). Cada fila: **Pass / Fail** + evidencia (ID conversación, timestamp, captura).

### 5.1 Escenarios conversacionales y routing

| ID | Escenario | Resultado esperado | Pass |
|---|---|---|---|
| U-BOT-01 | Saludo / inicio guion | Captura paso guion; `EventoOperativo` con ruta guion | ☐ |
| U-BOT-02 | Pregunta precio paquete vigente | Monto solo de tool; `RegistroConsultaCatalogo` | ☐ |
| U-BOT-03 | Precio de paquete **sin** fila vigente | Safe/handoff; **sin** inventar monto | ☐ |
| U-BOT-04 | FAQ cubierta por K publicado | Respuesta con cita; rerank ≥ 0.85; `RegistroRecuperacion` | ☐ |
| U-BOT-05 | FAQ sin conocimiento / score &lt; 0.85 | Safe + handoff + alerta | ☐ |
| U-BOT-06 | Pedido explícito de humano | `escalado` + notificación | ☐ |
| U-BOT-07 | Asesor toma control | Bot deja de responder | ☐ |
| U-BOT-08 | Intento devolver a bot (default) | 409 o denegado según política | ☐ |
| U-BOT-09 | Calificación → `calificado` / brief | Campos obligatorios; C1 muestra | ☐ |
| U-BOT-10 | Aforo vs paquete incoherente | Advertencia / alternativa / handoff (C7) | ☐ |

### 5.2 Frescura y catálogo

| ID | Escenario | Resultado esperado | Pass |
|---|---|---|---|
| U-BOT-11 | Publicar cambio ficha sede | Bot refleja en &lt; 60 s | ☐ |
| U-BOT-12 | Cambiar precio catálogo | Siguiente pregunta precio usa nuevo `PaquetePrecio` | ☐ |
| U-BOT-13 | Archivar documento | Deja de recuperarse de inmediato | ☐ |
| U-BOT-14 | Mismo día: copy + precio | Ambos reflejados (UAT 3.6) | ☐ |

### 5.3 Multimodal / anti-alucinación (si en corte)

| ID | Escenario | Resultado esperado | Pass |
|---|---|---|---|
| U-MED-01 | PDF con tabla tarifas | Scrub; bot **no** cotiza desde PDF | ☐ |
| U-MED-02 | Foto tarifa | OCR gate; monto solo tools | ☐ |
| U-MED-03 | Foto narrativa autorizada | Chunk indexable; pasa C5 | ☐ |
| U-MED-04 | Video ≤ 5 min | Transcript indexable; job termina; cita posible | ☐ |
| U-MED-05 | Video &gt; 5 min o &gt; 100 MB | Rechazo/error documentado | ☐ |
| U-MED-06 | XLS split precios vs narrativa | Precios en Prisma; no en pgvector como monto | ☐ |
| U-MED-07 | Adjunto lead imagen | Ligado a conversación; **no** biblioteca K global | ☐ |
| U-MED-08 | S3/Vision down simulado | Job `error` + alerta; sin versión a medias | ☐ |

### 5.4 Canales y cupo

| ID | Escenario | Resultado esperado | Pass |
|---|---|---|---|
| U-CH-01 | Msg FB | Hilo + respuesta bot | ☐ |
| U-CH-02 | Msg IG | Idem | ☐ |
| U-CH-03 | Msg WA (si corte) | Mismo cerebro + cupo | ☐ |
| U-CH-04 | Firma webhook inválida | Rechazo; sin side-effects | ☐ |
| U-CUP-01 | N msgs de prueba | Contador += N (política de unidad documentada) | ☐ |
| U-SED-01 | Jardín 2 | **No** recibe leads operativos | ☐ |

### 5.5 Telemetría

| ID | Escenario | Resultado esperado | Pass |
|---|---|---|---|
| U-TEL-01 | Admin abre msg bot en telemetría | Ruta + tools/RAG + cupo visibles (F7) | ☐ |
| U-TEL-02 | Handoff por C5 | `motivoHandoff` + alerta SLA | ☐ |

### 5.6 Bloque de firma

```
UAT chatbot Agentic RAG — Tres Cielos / Medina Systems
Entorno: staging / prod-like
Fecha: __________
Responsable aprobaciones cliente: __________    Firma: __________
Responsable Medina: __________                 Firma: __________
Resultado: ☐ APROBADO go-live bot    ☐ RECHAZADO (listar IDs Fail)
Excepciones firmadas (omisiones K/media/WA): ______________________
```

---

## 6. Rollback runbook (chatbot)

Objetivo: cortar daño (alucinaciones, costos, cola rota) en minutos, sin destruir CRM.

### 6.1 Severidad y primera respuesta

| Severidad | Ejemplo | Acción inmediata |
|---|---|---|
| **S1** | Montos inventados en prod (C3 roto) | Kill switch bot **OFF** + aviso asesores |
| **S1** | Cohere/OpenAI down masivo inventando o loopeando | Bot OFF o forzar safe-only si flag existe |
| **S2** | Cola &gt; 60 s sostenida; publish roto | Pausar publishes; escalar worker; bot texto puede seguir |
| **S2** | Worker ffmpeg crash loop | Deshabilitar accept video; bot resto OK |
| **S3** | Latencia alta sin alucinación | Monitorear; no apagar si C3/C5 OK |

### 6.2 Kill switch — feature flag bot off

| Paso | Acción | Verificación |
|---|---|---|
| 1 | Set `FF_BOT_ENABLED=false` (o `BOT_RESPONSES_ENABLED=false`) en **prod** API | Redeploy o hot-config según implementación |
| 2 | Webhooks siguen ACK (200) para no reintentar eternamente Meta/Twilio | Logs firma OK |
| 3 | Respuesta al lead: mensaje seguro fijo (“un asesor te contactará”) **o** silencio según política firmada | Canario |
| 4 | Asesores atienden bandeja; escalaciones manuales | Panel usable |
| 5 | Post-mortem: transcripts + `EventoOperativo` + flags C3/C5 | Acta |

**No** borrar leads ni vectores como “rollback”.

### 6.3 Rollback de release — API

| Paso | Acción |
|---|---|
| 1 | Identificar tag/deploy anterior verde en Railway |
| 2 | Redeploy imagen/commit previo del servicio `api` |
| 3 | **No** revertir migraciones destructivas ad hoc; solo forward-fix o migrate down **si** hay procedimiento ensayado |
| 4 | Smoke `/health/ready` + canario precio (C3) |
| 5 | Re-habilitar bot solo si canario OK |

### 6.4 Rollback — worker

| Paso | Acción |
|---|---|
| 1 | Pausar cola (BullMQ pause) o escalar worker a 0 |
| 2 | Redeploy worker a versión anterior (misma familia que API si comparten contrato job) |
| 3 | Reanudar cola; drenar jobs `error` con criterio admin |
| 4 | Si embeddings de la versión mala contaminaron índice: **reindex** controlado o invalidar versión documental (no mezclar dimensiones) |

### 6.5 Orden recomendado ante incidente C3

1. Flag bot OFF  
2. Congelar publishes de catálogo/K  
3. Rollback API si el bug es de release  
4. Auditar últimos N transcripts con monto  
5. Corregir + UAT exprés C3/C5  
6. Canario  
7. Flag ON  

---

## 7. DoD producción chatbot vs DoD panel

| Dimensión | **DoD chatbot (este doc)** | **DoD panel (producto/setup 04)** |
|---|---|---|
| Actor principal | Prospecto en Meta/WA | Asesor / coord / admin |
| Must calidad | C3, C5, C4, D-BOT, D-MED | F1–F7, superficies, RBAC |
| Canales | Webhooks + firma + cupo | Bandeja unificada consumiendo mismos hilos |
| IA | OpenAI + **Cohere obligatorio** | UI telemetría / conocimiento (frontend/08) |
| Storage | Obligatorio para K/media | Upload UI + poll job |
| Kill switch | Flag bot off | Panel puede seguir en modo humano |
| G1–G11 | G1, G2 (bot), G8, G9, G10 críticos bot | G3–G7, G11 panel/roles; G6 capacitación |
| Se puede go-live panel sin bot? | — | Solo modo humano asistido **si** se acuerda; no es el producto vendido Agentic RAG |
| Se puede go-live bot sin panel? | **No** (handoff, toma control, alertas, telemetría) | — |

**Regla:** go-live Jardín 1 del **producto completo** exige **ambos** DoD. Este documento es el candado específico del cerebro conversacional.

Checklist DoD chatbot (binario resumen):

| ID | Condición |
|---|---|
| DoD-BOT-1 | C3/C5/C4 verdes |
| DoD-BOT-2 | D-BOT-1…8 verdes |
| DoD-BOT-3 | D-MED Must del corte verdes |
| DoD-BOT-4 | Canales del corte operables |
| DoD-BOT-5 | Telemetría F7 bot |
| DoD-BOT-6 | Cupo 1k + Jardín 1 only |
| DoD-BOT-7 | Infra I6 + rollback ensayado |
| DoD-BOT-8 | UAT §5 firmado; ningún NO-GO §8 |

---

## 8. Criterios de NO salir a producción

Si **cualquiera** de estos es verdadero, **prohibido** abrir tráfico prod al bot (o mantener flag OFF):

| # | Condición NO-GO | Por qué |
|---|---|---|
| NG1 | **Alucinación de montos** detectada (C3 ≠ 0) en UAT o canario | Daño comercial directo; rompe propuesta de valor |
| NG2 | **Rerank sin Cohere** (key ausente, mock en prod, umbral desactivado, bypass) | C5 incumplible; riesgo de RAG inventado |
| NG3 | **Object storage ausente** o no writable en prod | D-KNW-10 / D-MED-3; binarios y frescura media no auditables |
| NG4 | **Jardín 2 operable por error** (recibe leads, cupo o asignación) | Fuera de contrato; G7 roto |
| NG5 | Worker sin ffmpeg cuando el corte incluye video publicado | D-MED-9; pipeline mentiroso |
| NG6 | Cola sin alerta y jobs &gt; 60 s sin visibilidad en UAT | C4 no demostrable |
| NG7 | Telemetría bot ausente (no `EventoOperativo` / F7 fail) | No hay auditoría post-incidente |
| NG8 | Keys staging en prod o buckets/vectores compartidos | Contaminación y riesgo de seguridad |
| NG9 | Kill switch no probado | No hay rollback S1 |
| NG10 | WA/Meta prod apuntando a staging (o viceversa) | Fuga de leads / pruebas en clientes reales |

Cualquier NG activo → fecha de go-live bot **deslizada**; CRM humano puede continuar solo con acuerdo explícito escrito (no cuenta como entrega Agentic RAG).

---

## 9. Relación con G1–G11

| Gate producto | Relación con este doc |
|---|---|
| G1 Guiones aprobados | Prerrequisito U-BOT guion |
| G2 UAT firmado | Incluye matriz §5 |
| G3–G6 CRM/asignación/notif/capacitación | DoD panel; necesarios para handoff real |
| G7 Jardín 1 only | NG4 si falla |
| G8 K + catálogo mínimo | P17 / tools precio |
| G9 Frescura | = C4 |
| G10 C3 y C5 | Núcleo §2.1 |
| G11 F1/F5/F7 | F7 ⊂ telemetría bot; F1/F5 panel |

---

## 10. Criterio de cierre de este entregable

Quedan definidos: gate go-live del chatbot (C3/C5/C4, D-BOT, D-MED, canales, telemetría, cupo), checklists binarios pre-prod y prod, UAT firmable con matriz de escenarios, runbook de rollback (API, worker, feature flag bot off), distinción DoD chatbot vs DoD panel, dependencias a backend/10 + frontend/09 (y contratos 02/07–09 y frontend/08), y criterios explícitos de **NO** salir a prod (alucinación de montos, rerank sin Cohere, storage ausente, Jardín 2 operable por error, entre otros).
