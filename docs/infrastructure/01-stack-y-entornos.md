# Infraestructura — stack y entornos

Requisitos de infraestructura para operar Event Master System (Tres Cielos) con **Agentic RAG** multimodal (PDF/Word/XLS/foto/video).

**Plan de implementación (fases, checklists, riesgos):** [02-plan-implementacion-chatbot-infra.md](02-plan-implementacion-chatbot-infra.md). Gate de salida a prod del bot: [../setup/09-criterios-salida-produccion-chatbot.md](../setup/09-criterios-salida-produccion-chatbot.md).

**PaaS elegido:** [Railway](../setup/07-railway-deploy.md) (web, api, Postgres, Redis + object storage S3-compatible).

Stack de referencia: NestJS (API + workers), Next.js (panel), Prisma, PostgreSQL + **pgvector** + **Full Text Search**, **object storage obligatorio**, proveedores OpenAI (LLM/embeddings/vision/transcription) y **Cohere Rerank**, worker con **ffmpeg** para video.

## 1. Componentes lógicos

| Componente | Rol |
|---|---|
| API NestJS | Webhooks Meta/Twilio, orquestador, CRM, auth de panel, upload conocimiento |
| Worker de ingesta | Chunk, embed, FTS, invalidación; parsers MIME; Vision/Transcription; **ffmpeg** extract audio |
| Panel Next.js | Superficies operativas ([../frontend/00-superficies.md](../frontend/00-superficies.md)) |
| PostgreSQL | Transaccional + catálogo + vectores + FTS + metadatos de media |
| **Object storage (obligatorio)** | Binarios fuente PDF/Word/Excel/imagen/video + adjuntos de lead (`StoragePort`) |
| Email transaccional | Alertas a asesores |
| Proveedores IA | OpenAI (LLM, embeddings, vision, transcription) + Cohere Rerank |

```
Meta / Twilio ──webhooks──► API NestJS ──► PostgreSQL
                               │              ▲
                               ├──► Worker ingesta (jobs + ffmpeg)
                               ├──► Object storage (S3)
                               ├──► OpenAI / Cohere
Panel Next.js ──HTTPS──► API NestJS
```

Aceptación media / ports: [../backend/09-aceptacion-y-matriz-tests.md](../backend/09-aceptacion-y-matriz-tests.md). Criterios INF/D-MED: [../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md).

## 2. Base de datos

Requisitos:

- Extensión **pgvector** habilitada.
- Full Text Search nativo (configuración en español recomendada para copy local).
- Backups automatizados y retención acorde al acuerdo comercial.
- Migraciones vía Prisma en cada entorno.
- Índices: IVFFlat/HNSW (o equivalente) para embeddings; GIN para `tsvector`; índices B-tree en filtros `estado`, `sede_id`, `vigente_*`.
- Tablas de documento/adjunto guardan **`storageKey` + MIME + checksum**, no el blob.

Separación lógica (mismo cluster aceptable en v1):

- Esquema/tablas CRM + catálogo.
- Tablas de fragmentos vectoriales + FTS.
- No se requiere un segundo motor de búsqueda en v1.

## 3. Object storage (obligatorio)

| Requisito | Detalle |
|---|---|
| Proveedor | S3-compatible (AWS S3, Cloudflare R2, MinIO local, bucket Railway/addon) |
| Port | `StoragePort` (`put` / `getSignedUrl` / `delete` / `exists`) — ver backend/09 §7 |
| Contenido | Fuentes de conocimiento + adjuntos de conversación |
| Seguridad | Buckets privados; URLs firmadas de corta vida; mínimo privilegio IAM |
| Entornos | Bucket **distinto** por `dev` / `staging` / `prod` (no compartir objetos) |
| CI | Fake FS / MemoryStorage o MinIO en Compose; nunca credenciales prod |

Sin object storage **no** se considera cumplido D-KNW-10 / D-MED-3 / INF-13.

## 4. Jobs, frescura y worker video

- Cola de trabajos (BullMQ/Redis, SQS, o equivalente) para ingesta documental.
- Prioridad **alta** en eventos `documento.publicado` y `documento.archivado`.
- Timeout y reintentos con alerta a admin si el job supera el SLA de **60 s** a “listo” (C4).
- Publicación de catálogo: path síncrono DB (sin cola de embeddings).
- **Worker video:** la imagen/runtime del worker **debe incluir binario ffmpeg** (o `FFMPEG_PATH` apuntando a él) para extraer audio antes de `TranscriptionPort`. En CI, T-MED-VID puede skippearse si el binario no está; en staging/prod es **obligatorio** para U-MED-7.

## 5. Secretos y configuración

Variables conceptuales (nombres ilustrativos). Inventario GitHub: [../github/04-entornos-secretos-gobierno.md](../github/04-entornos-secretos-gobierno.md).

| Grupo | Nombres | Notas |
|---|---|---|
| DB / cola | `DATABASE_URL`, `REDIS_URL` | |
| Meta / Twilio | `META_*`, `TWILIO_*` | Firma webhooks |
| **OpenAI** | `OPENAI_API_KEY` (o `LLM_API_KEY` + keys dedicadas) | LlmPort, EmbeddingsPort, VisionPort, TranscriptionPort |
| **Cohere** | `COHERE_API_KEY`, `RERANK_THRESHOLD` | Default umbral **0.85** (C5) |
| **S3** | `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_ENDPOINT` | StoragePort — **obligatorio** staging/prod |
| Worker | `FFMPEG_PATH` | Opcional si ffmpeg está en `PATH` |
| Panel | `JWT_SECRET` / sesión, SMTP si aplica | |

Reglas:

- Secretos solo en el gestor del entorno (nunca en el repo).
- Rotación documentada en runbook operativo Medina.
- Separar claves por entorno (dev / staging / prod).
- CI PR: **mock** de OpenAI/Cohere; `@live` solo staging.

## 6. Entornos

| Entorno | Propósito |
|---|---|
| **dev** | Desarrollo local / sandbox (Compose + MinIO o fake storage) |
| **staging** | UAT con Tres Cielos; canales de prueba; `@live` media |
| **prod** | Jardín 1 go-live |

Cada entorno tiene su propia base, bucket S3, claves de Meta/Twilio de prueba vs producción, y biblioteca de conocimiento/catálogo independiente (no compartir vectores ni objetos de staging con prod).

## 7. Observabilidad y telemetría de producto

### 7.1 Infraestructura

- Logs estructurados de webhooks, ruta del orquestador, tools, rerank scores, jobs de ingesta, MIME, scrub tariff, errores Storage/Vision/Transcription.
- Métricas: latencia de respuesta bot, tasa de handoff, duración de jobs de publicación, errores de proveedores IA, fallos ffmpeg.
- Alertas operativas: fallo sostenido de webhooks, cola de ingesta atrasada (&gt; 60 s), error de rerank/LLM/storage.

### 7.2 Eventos de producto (obligatorios)

Además de logs de infra, el sistema persiste `EventoOperativo` alineado a [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) §7:

- Bot: ruta, tools/RAG, cupo, handoff.
- Humano: asignación, toma de control, latencia SLA 15–30 min, etapas, reasignaciones.

Estos eventos alimentan la superficie **Telemetría operativa** del panel y el timeline del expediente. No amarran un vendor concreto (Grafana, Datadog, etc.); el contrato es de dominio.

No sustituye SIEM ni guardia 24/7 (fuera de alcance de membresía base).

## 8. Seguridad y red

- HTTPS terminado en el edge.
- Webhooks con verificación de firma (Meta / Twilio).
- Panel solo para usuarios autenticados con RBAC.
- Principio de mínimo privilegio en DB y storage.
- Rate limiting básico en webhooks públicos.
- Buckets privados; no listado público de objetos de conocimiento.

## 9. Escalado (orientación v1)

- Un jardín activo, cupo 1,000 msgs/mes: footprint pequeño (API + worker + Postgres gestionado + bucket).
- El cuello de botella típico será latencia de LLM/rerank/vision, no CPU del API; video añade CPU/ffmpeg en worker.
- Al activar segundo jardín: aislar cupo y revisar capacidad de worker de ingesta + storage.

## 10. Criterio de cierre de este entregable

Quedan documentados componentes (incl. **object storage obligatorio** y **ffmpeg en worker**), requisitos de Postgres/pgvector/FTS, jobs de frescura, secretos OpenAI/Cohere/S3, entornos y observabilidad (infra + eventos de producto). PaaS de referencia: **Railway** ([../setup/07-railway-deploy.md](../setup/07-railway-deploy.md)).

**Siguiente lectura:** plan ordenado de puesta en marcha (API + worker + BullMQ + capacity + CI pgvector + RPO/RTO) en [02-plan-implementacion-chatbot-infra.md](02-plan-implementacion-chatbot-infra.md).
