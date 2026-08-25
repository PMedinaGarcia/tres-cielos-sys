# Pipeline OpenAI y proveedores — vendor fijado, ports y cupo

Contrato de integración de **inteligencia artificial** del Event Master System (Tres Cielos). Fija el vendor LLM/embeddings/Vision/Whisper, el reranker, las variables de entorno, el patrón ports/adapters en NestJS, la política de costo/cupo y el **anti-alcance** explícito.

Complementa: [02-orquestador-agentico.md](02-orquestador-agentico.md), [03-rag-avanzado.md](03-rag-avanzado.md), [08-ingesta-multimodal.md](08-ingesta-multimodal.md), [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md).

## 1. Objetivo

Operar Agentic RAG con proveedores **cerrados y auditables**:

- **Montos y paquetes** → solo tools Prisma (nunca LLM “estimando”).
- **Narrativa** → hybrid search + Cohere Rerank (≥ 0.85) + LLM estricto con citas.
- **Media** (PDF, Word, XLS, foto, video) → parsers + OpenAI Vision/Whisper cuando aplique → texto derivado indexable; ver [08-ingesta-multimodal.md](08-ingesta-multimodal.md).
- **Fallo** (umbral, sin filas, sin cita, OCR de tarifas) → safe + handoff; nunca inventar.

## 2. Vendor fijado (decisión de producto)

| Capacidad | Proveedor | SDK / API | Notas |
|---|---|---|---|
| LLM orquestador (routing / function calling) | **OpenAI** | **SDK oficial OpenAI** (`openai` Node) | Tools registradas; sin SQL libre |
| LLM generador (respuesta anclada RAG) | **OpenAI** | Mismo SDK | Prompt estricto; citas obligatorias |
| Embeddings (query + indexación) | **OpenAI** | Mismo SDK | Dimensión fija por entorno; no mezclar modelos sin reindex |
| Vision (fotos / páginas rasterizadas) | **OpenAI** | Mismo SDK (Vision / multimodal chat) | Solo narrativa; scrub de tarifas |
| Whisper (audio de video / nota de voz si se habilita) | **OpenAI** | Mismo SDK (Audio Transcriptions) | Texto derivado → chunk/embed |
| Rerank | **Cohere** | API Cohere Rerank | Umbral default **0.85** |

**No hay segundo vendor LLM en v1.** Cambiar de modelo dentro de OpenAI es configuración; cambiar de proveedor LLM es change order.

### 2.1 Anti-alcance (prohibido en v1)

| Excluido | Motivo |
|---|---|
| **Vercel AI SDK** (`ai`, `@ai-sdk/*`) | Stack NestJS workers; contrato es SDK OpenAI oficial + adapters propios |
| **OpenAI Assistants API** (threads, Assistants, vector stores OpenAI) | La memoria y el orquestador viven en **nuestro** Postgres + Prisma + cola; no en threads del vendor |
| Agents multi-día / drips autónomos | Fuera de producto (ver orquestador §9) |
| Browser tools / SQL libre / code interpreter como tool del bot | Riesgo de alucinación y fuga de datos |
| Cotizar montos desde OCR, Vision, Whisper o fragmentos RAG | Flag `no_recuperable_precio` + gate del orquestador |
| Mezclar claves / modelos de embeddings entre staging y prod sin reindex | Corrompe similitud |

## 3. Modelos de referencia (configurables por env)

Los IDs exactos pueden actualizarse sin cambiar arquitectura; lo que **no** cambia es el rol de cada modelo.

| Rol | Variable | Valor de referencia v1 | Uso |
|---|---|---|---|
| Orquestador + tools | `OPENAI_MODEL_ORCHESTRATOR` | `gpt-4.1-mini` (o sucesor acordado) | Clasificación / function calling |
| Generador RAG | `OPENAI_MODEL_GENERATOR` | `gpt-4.1-mini` | Respuesta anclada a fragmentos |
| Embeddings | `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Indexación + query vectorial |
| Vision | `OPENAI_MODEL_VISION` | Modelo multimodal chat con visión (misma familia acordada) | Descripción / OCR controlado de fotos y páginas |
| Whisper | `OPENAI_WHISPER_MODEL` | `whisper-1` | Transcripción audio ≤ límites de producto |
| Rerank | `COHERE_RERANK_MODEL` | Modelo Rerank vigente en cuenta Cohere | Scores 0–1; umbral `RERANK_THRESHOLD` |

Reglas:

- Documentar en runbook la **dimensión del embedding** al fijar el modelo; migrar índice = re-ingesta completa del entorno.
- Orquestador y generador pueden ser el mismo modelo si el costo lo justifica; no pueden compartir contexto con Assistants.
- Vision/Whisper **no** invocan tools de precio; solo producen texto derivado para ingesta o contexto de turno (adjuntos de canal).

## 4. Variables de entorno

### 4.1 Obligatorias para Agentic RAG operativo

| Variable | Obligatoria* | Descripción |
|---|---|---|
| `OPENAI_API_KEY` | Sí (orquestador/RAG/ingesta) | Clave proyecto OpenAI del entorno |
| `OPENAI_BASE_URL` | No | Solo si hay proxy/compatible; default API OpenAI |
| `OPENAI_ORG_ID` / `OPENAI_PROJECT_ID` | Recomendada | Aislamiento facturación por entorno |
| `OPENAI_MODEL_ORCHESTRATOR` | Sí en full | Ver §3 |
| `OPENAI_MODEL_GENERATOR` | Sí en full | Ver §3 |
| `OPENAI_EMBEDDING_MODEL` | Sí en full | Ver §3 |
| `OPENAI_MODEL_VISION` | Condicional | Obligatoria si hay fotos / OCR de página |
| `OPENAI_WHISPER_MODEL` | Condicional | Obligatoria si hay video / audio |
| `COHERE_API_KEY` | Sí (RAG) | Rerank |
| `COHERE_RERANK_MODEL` | No | Default del adaptador |
| `RERANK_THRESHOLD` | No | Default producto **`0.85`** |
| `RERANK_TOP_N` | No | Candidatos pre-rerank (10–20) |
| `RERANK_TOP_K_LLM` | No | Fragmentos al LLM (3–4) |

\* Smoke CRM sin bot puede arrancar sin estas claves; el módulo IA debe degradar con log claro y no inventar respuestas.

### 4.2 Cupo, costo y timeouts

| Variable | Default orientativo | Descripción |
|---|---|---|
| `AI_MAX_TOKENS_ORCHESTRATOR` | p. ej. 1024 | Cap de completion orquestador |
| `AI_MAX_TOKENS_GENERATOR` | p. ej. 800 | Cap de respuesta al lead |
| `AI_MAX_INPUT_CHARS_RAG` | p. ej. 12_000 | Truncar contexto de fragmentos |
| `AI_REQUEST_TIMEOUT_MS` | p. ej. 45_000 | Timeout HTTP a OpenAI/Cohere |
| `AI_MAX_RETRIES` | 2 | Reintentos idempotentes (solo errores transitorios) |
| `CUPO_MENSUAL_MENSAJES` | `1000` | Membresía mensajería |
| `CUPO_AI_TOKENS_SOFT_LIMIT` | acordado | Alerta admin al aproximarse |
| `CUPO_AI_TOKENS_HARD_LIMIT` | opcional | Si se pacta: degradar a safe/handoff, no inventar |

### 4.3 Object storage (obligatorio con multimodal)

Con pipeline multimodal activo, el binario **siempre** vive en object storage; no en Postgres como BLOB principal. Detalle: [08-ingesta-multimodal.md](08-ingesta-multimodal.md).

| Variable | Descripción |
|---|---|
| `STORAGE_PROVIDER` | `s3` \| `r2` \| `gcs` (u otro S3-compatible) |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` | Endpoint y bucket por entorno |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Credenciales (o IAM/OIDC según PaaS) |
| `STORAGE_PUBLIC_BASE_URL` | Solo si hay URLs firmadas públicas; preferir URLs firmadas de corta vida |

Secretos **nunca** en repo; separación dev / staging / prod ([../github/04-entornos-secretos-gobierno.md](../github/04-entornos-secretos-gobierno.md)).

## 5. Ports y adapters (NestJS)

El dominio **no** importa el cliente OpenAI/Cohere directamente en orquestador, RAG ni CRM. Todo pasa por interfaces (ports) implementadas por adapters.

```
ConversationOrchestratorModule
RagPipelineModule
KnowledgeIngestionModule / MediaRouter
        │
        ▼
┌───────────────────────────────────────┐
│  Ports (interfaces de dominio)        │
│  LlmPort / EmbeddingPort /            │
│  VisionPort / TranscriptionPort /     │
│  RerankPort / ObjectStoragePort        │
└───────────────────┬───────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
 OpenAIAdapter  CohereAdapter  S3Adapter
 (SDK oficial)  (Rerank API)   (storage)
```

### 5.1 Ports mínimos

| Port | Operaciones conceptuales | Consumidores |
|---|---|---|
| `LlmPort` | `complete`, `completeWithTools` | Orquestador, generador RAG |
| `EmbeddingPort` | `embedOne`, `embedBatch` | Ingesta, query hybrid |
| `VisionPort` | `describeOrExtractText` | MediaRouter (foto / página) |
| `TranscriptionPort` | `transcribeAudio` | MediaRouter (video / audio) |
| `RerankPort` | `rerank(query, passages[])` | RagPipelineModule |
| `ObjectStoragePort` | `put`, `get`, `signedUrl`, `delete` | Ingesta, adjuntos canal |

### 5.2 Reglas de implementación

1. Timeouts y reintentos viven en el adapter; el dominio recibe error tipificado (`ProviderTimeout`, `ProviderUnavailable`, `InvalidMedia`).
2. Ante fallo de OpenAI/Cohere en turno de bot → **safe + handoff** (`proveedor_ia` / motivo tipificado); **nunca** respuesta inventada.
3. Tests unitarios del orquestador usan fakes de ports; CI de PR **no** llama OpenAI/Cohere reales (mocks); nightly opcional con secretos de *dev*.
4. Un solo módulo `AiProvidersModule` registra adapters según env; feature flags pueden desactivar Vision/Whisper sin romper texto.

## 6. Flujo de uso por capacidad

```
Mensaje / job de ingesta
        │
        ├─ ¿Routing / tools? ──► LlmPort.completeWithTools ──► ToolsCatalog (Prisma)
        ├─ ¿RAG documental? ──► EmbeddingPort + FTS ──► RerankPort (≥ 0.85)
        │                              └─► LlmPort.complete (fragmentos + cita)
        ├─ ¿Foto / página? ──► ObjectStorage + VisionPort ──► texto + scrub tarifas
        └─ ¿Video / audio? ──► ObjectStorage + TranscriptionPort ──► texto + scrub
```

Montos: **solo** tras tool Prisma. Si el texto derivado o un fragmento tiene `no_recuperable_precio`, el orquestador **no** cotiza desde ese material ([02-orquestador-agentico.md](02-orquestador-agentico.md) §4.5).

## 7. Política de costo

### 7.1 Principios

| Principio | Aplicación |
|---|---|
| Barato primero | Orquestador/generador en modelo “mini” salvo UAT que demuestre necesidad de modelo mayor |
| No pagar dos veces | No re-embeber versión inactiva; invalidar, no duplicar índice vivo |
| Media cara = asíncrona | Foto/video en worker con SLA propio; no bloquear webhook del canal más allá del ack |
| Rerank obligatorio en rama documental | Evita LLM sobre top-k amplios (costo + alucinación) |
| Vision/Whisper solo si MIME lo exige | PDF texto-nativo no pasa por Vision |

### 7.2 Estimación de unidades (orden de magnitud)

Registrar en `EventoOperativo` / `ContadorUso` (tokens o unidades equivalentes):

| Operación | Contabilizar |
|---|---|
| Embedding query | tokens input embedding |
| Embedding batch ingesta | tokens por fragmento |
| Orquestador | prompt + completion (+ tool JSON) |
| Generador RAG | prompt (fragmentos) + completion |
| Rerank | pasajes × query (unidades Cohere) |
| Vision | tokens imagen + texto |
| Whisper | duración audio (segundos / minutos facturados) |

Alertar a Medina/admin al soft limit; hard limit solo si está pactado comercialmente (dominio Cupo).

## 8. Cupo de tokens y degradación

```
Turno bot necesita IA
      ↓
¿Hard limit AI alcanzado? ──sí──► Safe + handoff (motivo cupo_ia) + alerta
      │ no
      ↓
Ejecutar ports con caps de §4.2
      ↓
Persistir uso estimado
      ↓
¿Soft limit? ──sí──► Alerta admin (bot sigue, salvo política distinta)
```

Reglas:

- Agotar cupo de **mensajería** y cupo de **IA** se reportan por separado.
- Degradar ≠ inventar: si no hay presupuesto de IA, el bot no “adivina” FAQ ni precios.
- El panel de telemetría muestra consumo vs tope ([../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md)).

## 9. Seguridad y datos enviados al vendor

| Dato | ¿Se envía a OpenAI/Cohere? | Nota |
|---|---|---|
| Texto del mensaje del lead | Sí (orquestador/RAG/rerank) | Necesario para el producto |
| Fragmentos publicados | Sí (generador/rerank) | Solo corpus autorizado |
| Binarios (foto/video/PDF) | Sí a OpenAI si Vision/Whisper/parse en cloud; storage propio primero | Object storage es fuente; vendor recibe copia temporal vía URL o bytes |
| Precios vigentes / filas Prisma | Solo el **resultado** de tool que el orquestador ya obtuvo | No subir el catálogo completo al vendor “por si acaso” |
| Credenciales, JWT, secretos internos | **Nunca** | — |
| Contratos legales / NDA (fuera de inventario K) | **No** indexar ni enviar | Ver inventário K |

Cumplir retención y política de datos del acuerdo; no entrenar modelos del cliente con APIs que lo prohíban / optar por zero data retention si el contrato OpenAI/Cohere del proyecto lo permite y está documentado en runbook.

## 10. Criterios de cierre de este entregable

| # | Criterio | Evidencia |
|---|---|---|
| 1 | Vendor LLM/embeddings/Vision/Whisper = OpenAI vía **SDK oficial**; rerank = Cohere 0.85 | Este doc §2–3 + env staging |
| 2 | Ports/adapters documentados; sin Assistants ni Vercel AI SDK | §2.1, §5 |
| 3 | Env vars y caps de tokens definidos | §4 |
| 4 | Política de costo + cupo soft/hard y degradación a safe/handoff | §7–8 |
| 5 | Object storage obligatorio cuando multimodal está activo | §4.3 + doc 08 |
| 6 | CI de PR no depende de llamadas reales a OpenAI/Cohere | §5.2 |

## 11. Relación con otros docs

| Doc | Relación |
|---|---|
| [02-orquestador-agentico.md](02-orquestador-agentico.md) | Usa `LlmPort` + tools; gate `no_recuperable_precio` |
| [03-rag-avanzado.md](03-rag-avanzado.md) | Embeddings + Cohere + generador |
| [04-ingesta-conocimiento.md](04-ingesta-conocimiento.md) | Jobs que llaman Embedding/Vision/Whisper |
| [08-ingesta-multimodal.md](08-ingesta-multimodal.md) | MediaRouter, SLAs, allowlist MIME |
| [../setup/02-backend-setup.md](../setup/02-backend-setup.md) | Arranque y tabla de env (alinear nombres a este doc al implementar) |
