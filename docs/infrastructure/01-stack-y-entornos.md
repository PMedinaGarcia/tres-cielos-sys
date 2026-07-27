# Infraestructura — stack y entornos

Requisitos de infraestructura para operar Event Master System (Tres Cielos) con **Agentic RAG**, sin fijar un vendor de cloud obligatorio.

Stack de referencia: NestJS (API + workers), Next.js (panel), Prisma, PostgreSQL + **pgvector** + **Full Text Search**, proveedores de embeddings/LLM y **Cohere Rerank**.

## 1. Componentes lógicos

| Componente | Rol |
|---|---|
| API NestJS | Webhooks Meta/Twilio, orquestador, CRM, auth de panel |
| Worker de ingesta | Chunk, embed, FTS, invalidación de versiones (prioridad alta al publicar) |
| Panel Next.js | Superficies operativas ([../frontend/00-superficies.md](../frontend/00-superficies.md)) |
| PostgreSQL | Transaccional + catálogo + vectores + FTS |
| Object storage (opcional) | Archivos fuente PDF/Word/Excel originales |
| Email transaccional | Alertas a asesores |
| Proveedores IA | Embeddings, LLM generador/orquestador, Cohere Rerank |

```
Meta / Twilio ──webhooks──► API NestJS ──► PostgreSQL
                               │              ▲
                               ├──► Worker ingesta (jobs)
                               ├──► LLM / Embeddings / Rerank
Panel Next.js ──HTTPS──► API NestJS
```

## 2. Base de datos

Requisitos:

- Extensión **pgvector** habilitada.
- Full Text Search nativo (configuración en español recomendada para copy local).
- Backups automatizados y retención acorde al acuerdo comercial.
- Migraciones vía Prisma en cada entorno.
- Índices: IVFFlat/HNSW (o equivalente) para embeddings; GIN para `tsvector`; índices B-tree en filtros `estado`, `sede_id`, `vigente_*`.

Separación lógica (mismo cluster aceptable en v1):

- Esquema/tablas CRM + catálogo.
- Tablas de fragmentos vectoriales + FTS.
- No se requiere un segundo motor de búsqueda en v1.

## 3. Jobs y frescura

- Cola de trabajos (BullMQ/Redis, SQS, o equivalente) para ingesta documental.
- Prioridad **alta** en eventos `documento.publicado` y `documento.archivado`.
- Timeout y reintentos con alerta a admin si el job supera el SLA de **60 s** a “listo”.
- Publicación de catálogo: path síncrono DB (sin cola de embeddings).

## 4. Secretos y configuración

Variables conceptuales (nombres ilustrativos):

- `DATABASE_URL`
- Credenciales Meta (app, verify token, page tokens)
- Credenciales Twilio WhatsApp
- API keys LLM / embeddings
- `COHERE_API_KEY` (rerank)
- Secretos de sesión/JWT del panel
- SMTP / proveedor email
- Umbral de rerank (default `0.85`)

Reglas:

- Secretos solo en el gestor del entorno (nunca en el repo).
- Rotación documentada en runbook operativo Medina.
- Separar claves por entorno (dev / staging / prod).

## 5. Entornos

| Entorno | Propósito |
|---|---|
| **dev** | Desarrollo local / sandbox |
| **staging** | UAT con Tres Cielos; canales de prueba |
| **prod** | Jardín 1 go-live |

Cada entorno tiene su propia base, claves de Meta/Twilio de prueba vs producción, y biblioteca de conocimiento/catálogo independiente (no compartir vectores de staging con prod).

## 6. Observabilidad y telemetría de producto

### 6.1 Infraestructura

- Logs estructurados de webhooks, ruta del orquestador, tools, rerank scores, jobs de ingesta.
- Métricas: latencia de respuesta bot, tasa de handoff, duración de jobs de publicación, errores de proveedores IA.
- Alertas operativas: fallo sostenido de webhooks, cola de ingesta atrasada (&gt; 60 s), error de rerank/LLM.

### 6.2 Eventos de producto (obligatorios)

Además de logs de infra, el sistema persiste `EventoOperativo` alineado a [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) §7:

- Bot: ruta, tools/RAG, cupo, handoff.
- Humano: asignación, toma de control, latencia SLA 15–30 min, etapas, reasignaciones.

Estos eventos alimentan la superficie **Telemetría operativa** del panel y el timeline del expediente. No amarran un vendor concreto (Grafana, Datadog, etc.); el contrato es de dominio.

No sustituye SIEM ni guardia 24/7 (fuera de alcance de membresía base).

## 7. Seguridad y red

- HTTPS terminado en el edge.
- Webhooks con verificación de firma (Meta / Twilio).
- Panel solo para usuarios autenticados con RBAC.
- Principio de mínimo privilegio en DB y storage.
- Rate limiting básico en webhooks públicos.

## 8. Escalado (orientación v1)

- Un jardín activo, cupo 1,000 msgs/mes: footprint pequeño (API + worker + Postgres gestionado).
- El cuello de botella típico será latencia de LLM/rerank, no CPU del API.
- Al activar segundo jardín: aislar cupo y revisar capacidad de worker de ingesta.

## 9. Criterio de cierre de este entregable

Quedan documentados componentes, requisitos de Postgres/pgvector/FTS, jobs de frescura, secretos, entornos y observabilidad (infra + eventos de producto) para implementar sin amarrar un único cloud vendor.
