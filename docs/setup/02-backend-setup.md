# Setup inicial — Backend (API NestJS + workers)

Guía profunda para levantar el **backend** de Event Master System / Tres Cielos (Medina Systems): API NestJS, worker de ingesta, PostgreSQL (pgvector + FTS), cola de jobs y secretos de canales/IA.

**Estado del repo (2026-07-27):** no existe código de aplicación backend. Inventario real del workspace:

| Existe | No existe (pendiente de scaffold) |
|---|---|
| Documentación en `docs/` (producto, backend, database, frontend, infra) | `apps/api/`, `package.json`, `pnpm-workspace.yaml`, `turbo.json` |
| PDF comercial en raíz | Prisma (`schema.prisma`, migraciones, seeds) |
| | Docker / `docker-compose*`, `.env.example` |
| | NestJS modules, guards, controllers, workers |

Este documento describe el **setup objetivo** alineado a los contratos ya escritos. Donde algo solo vive en diseño, se marca **[PENDIENTE / OBJETIVO]**. Cuando exista scaffold, el código gana y este doc se alinea (mismas reglas que DTOs y frontend).

---

## Índice

1. [Prerrequisitos](#1-prerrequisitos)
2. [Estructura del backend y módulos/dominios](#2-estructura-del-backend-y-módulosdominios)
3. [Variables de entorno](#3-variables-de-entorno)
4. [Base de datos: creación, migraciones, seeds](#4-base-de-datos-creación-migraciones-seeds)
5. [Instalación, scripts y arranque local](#5-instalación-scripts-y-arranque-local)
6. [Auth y seguridad básica para desarrollo](#6-auth-y-seguridad-básica-para-desarrollo)
7. [Health checks y smoke tests post-setup](#7-health-checks-y-smoke-tests-post-setup)
8. [Integración con frontend e infra](#8-integración-con-frontend-e-infra)
9. [Troubleshooting](#9-troubleshooting)
10. [Criterios de éxito del setup backend](#10-criterios-de-éxito-del-setup-backend)
11. [Referencias cruzadas](#11-referencias-cruzadas)

---

## 1. Prerrequisitos

### 1.1 Runtime y herramientas CLI

| Herramienta | Uso | Estado |
|---|---|---|
| **Node.js** LTS (recomendado ≥ 20.x) | Runtime NestJS / Prisma CLI | **[OBJETIVO]** — versión exacta se fija al scaffold (`engines` en `package.json`) |
| **pnpm** (preferido) o npm/yarn | Workspace monorepo | **[OBJETIVO]** — monorepo propuesto en [../frontend/01-estructura.md](../frontend/01-estructura.md) §3 |
| **Git** | Clonar / ramas | Disponible en entorno local |
| **Docker Desktop** (recomendado) | Postgres + Redis locales | **[OBJETIVO]** — no hay `docker-compose` aún |
| **psql** o cliente GUI (pgAdmin, DBeaver, TablePlus) | Inspección DB / extensiones | Opcional pero útil |
| Nest CLI (`@nestjs/cli`) | Generar módulos | **[OBJETIVO]** tras scaffold |
| Prisma CLI | Migraciones / generate | **[OBJETIVO]** vía dep del workspace |

No hay versiones pinneadas en el repo hoy (gap: fijarlas al crear `package.json`).

### 1.2 Base de datos

| Requisito | Detalle | Fuente |
|---|---|---|
| **PostgreSQL** | Motor único v1 (CRM + catálogo + vectores + FTS) | [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §2 |
| Extensión **pgvector** | Embeddings / similitud | Infra §2; [../backend/03-rag-avanzado.md](../backend/03-rag-avanzado.md) |
| **Full Text Search** | `tsvector` / config español recomendada | Infra §2; RAG §3.2 |
| Índices | IVFFlat/HNSW (o equiv.) + GIN FTS + B-tree en `estado`, `sede_id`, vigencias | Infra §2 |

Imagen Docker sugerida (objetivo, no commiteada): `pgvector/pgvector:pg16` (o equivalente con `CREATE EXTENSION vector`).

### 1.3 Redis / cola de trabajos

| Componente | Rol | Estado |
|---|---|---|
| **Redis** (+ **BullMQ**) *o* SQS / equivalente | Jobs de ingesta documental (prioridad alta al publicar/archivar); SLA frescura &lt; 60 s | **[OBJETIVO]** — infra §3; vendor no amarrado |
| Worker Nest / proceso separado | Chunk → embed → FTS → invalidación de versión | [../backend/04-ingesta-conocimiento.md](../backend/04-ingesta-conocimiento.md); módulos en §2 |

Para **dev mínimo** (sin RAG real): se puede arrancar solo API + Postgres; el worker y Redis son obligatorios cuando se pruebe publicación de conocimiento.

### 1.4 Cuentas y secretos externos (desarrollo)

No bloquean el primer `listen()` del API, pero sí smoke de canales/IA:

| Proveedor | Para qué | Doc |
|---|---|---|
| Meta (Facebook / Instagram) | Webhooks Messenger/IG | Dominios §2 Canales |
| Twilio WhatsApp | Webhooks WA + plantillas utility | Dominios §2 |
| LLM + embeddings | Orquestador / RAG / rewrite | Infra §4; orquestador |
| **Cohere Rerank** | Umbral default **0.85** | Infra §4; RAG |
| SMTP / email transaccional | Alertas a asesores | Dominios §7; infra |

Regla: secretos **nunca** en el repo; solo gestor del entorno / `.env` local gitignored ([../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §4).

### 1.5 Conocimiento previo recomendado

Antes de implementar o depurar setup, leer en este orden:

1. [../README.md](../README.md) — mapa del sistema  
2. [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md)  
3. [../backend/01-dominios.md](../backend/01-dominios.md) + [02-orquestador-agentico.md](../backend/02-orquestador-agentico.md)  
4. [../database/01-modelo-conceptual.md](../database/01-modelo-conceptual.md)  
5. [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) + [06-guards-y-rbac.md](../backend/06-guards-y-rbac.md)

---

## 2. Estructura del backend y módulos/dominios

### 2.1 Lugar en el monorepo **[OBJETIVO]**

Propuesta canónica ([../frontend/01-estructura.md](../frontend/01-estructura.md) §3):

```
TRES-CIELOS-SYS/
├── apps/
│   ├── api/                 # NestJS — API HTTP + (opcional) mismo repo worker
│   └── web/                 # Next.js panel (fuera de este doc de setup)
├── packages/
│   └── shared/              # Zod/enums/types compartidos (espejo DTOs)
├── docs/
└── ...
```

Árbol interno sugerido de `apps/api` (aún no existe; alinear al scaffold real):

```
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/                 # Validación de env (Joi/Zod)
│   ├── common/                 # filters envelope, pipes, decorators @Public @Roles
│   ├── auth/
│   ├── channels/               # Meta / Twilio webhooks
│   ├── conversation/           # orquestador, guion, handoff
│   ├── tools-catalog/          # function calling → Prisma
│   ├── rag/
│   ├── knowledge-ingestion/    # publish + jobs
│   ├── crm/                    # lead, oportunidad, brief, calificación
│   ├── assignment/
│   ├── notifications/
│   ├── quota/
│   ├── audit/                  # EventoOperativo
│   ├── catalog/                # admin HTTP paquetes
│   ├── telemetria/
│   └── health/
├── test/                       # e2e smoke
├── package.json
├── nest-cli.json
└── tsconfig.json
```

Worker de ingesta: proceso Nest separado (`apps/api` con contexto `worker`) o `apps/worker` — **[PENDIENTE]** decisión de scaffold. Contrato de comportamiento en [../backend/04-ingesta-conocimiento.md](../backend/04-ingesta-conocimiento.md).

### 2.2 Módulos NestJS ↔ dominios de negocio

Tabla unificada (orquestador §2 + dominios):

| Módulo Nest **[OBJETIVO]** | Dominio ([01-dominios](../backend/01-dominios.md)) | Notas |
|---|---|---|
| `AuthModule` | §1 Identidad y acceso | JWT/sesión; guards en [06-guards-y-rbac](../backend/06-guards-y-rbac.md) |
| `ChannelsModule` | §2 Canales | Webhooks Meta/Twilio; firma ≠ JWT panel |
| `ConversationOrchestratorModule` | §3 Conversación / bot | Router guion \| catálogo \| RAG \| handoff \| safe |
| `ScriptModule` | §3 | Precalificación sin RAG |
| `ToolsCatalogModule` | §8 + catálogo | Tools Prisma; anti-alucinación montos |
| `RagPipelineModule` | §8 + [03-rag](../backend/03-rag-avanzado.md) | Hybrid + Cohere ≥ 0.85 |
| `HandoffModule` | §3, §7 | `escalado`, notificación, pausa bot |
| `KnowledgeIngestionModule` | §8 + [04-ingesta](../backend/04-ingesta-conocimiento.md) | Jobs &lt; 60 s |
| `CrmModule` | §4 Calificación, §5 CRM | Lead, oportunidad, brief, `listo_para_cotizar` |
| `AssignmentModule` | §6 Asignación | Sede → disponibilidad → round-robin |
| `NotificationsModule` | §7 | Panel (+ email cuando se pacte) |
| `QuotaModule` | §9 Cupo | 1,000 msgs/mes + uso Agentic RAG |
| `AuditModule` | §10 Telemetría | `EventoOperativo` bot + humano |
| `CatalogAdminModule` | §8 | CRUD/import HTTP admin (no tools del bot) |
| `HealthModule` | Infra | `@Public()`; ver §7 |

### 2.3 Flujos que el setup debe poder ejercer (cuando haya código)

```
Meta / Twilio ──webhooks──► API NestJS ──► PostgreSQL
                               │              ▲
                               ├──► Worker ingesta (Redis/cola)
                               ├──► LLM / Embeddings / Rerank
Panel Next.js ──HTTPS/JWT──► API NestJS
```

Diagrama de turno del bot: [../backend/02-orquestador-agentico.md](../backend/02-orquestador-agentico.md) §3. Plan de implementación por fases (módulos, `POST /orchestrator/turn`, PRs): [../backend/10-plan-implementacion-chatbot.md](../backend/10-plan-implementacion-chatbot.md).

### 2.4 Envelope y convenciones API

Ya fijados en [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) §1:

- JSON API: `camelCase`; enums de dominio: `snake_case` en español.
- Éxito: `{ "data": T }`; listas con `meta.page|pageSize|total`; error: `{ "error": { code, message, details? } }`.
- Validación Nest: `class-validator` + `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`).
- Prefijo `/api/v1`: **no** está en DTOs hoy; el cliente frontend parametriza `API_PREFIX` ([../frontend/05-api-y-hooks.md](../frontend/05-api-y-hooks.md)). Decidir en scaffold y documentar aquí.

---

## 3. Variables de entorno

**Estado:** no hay `.env.example` ni validación de config en código. La tabla siguiente consolida nombres **ilustrativos** de infra §4 y contratos de auth/canales/IA. Al implementar, publicar `.env.example` sin secretos y validar al boot.

### 3.1 Core / proceso

| Variable | Obligatoria | Descripción | Default sugerido (dev) |
|---|---|---|---|
| `NODE_ENV` | Sí | `development` \| `staging` \| `production` | `development` |
| `PORT` | Sí | Puerto HTTP API | `3011` (dejar `3010` al Next) |
| `APP_ENV` | Recomendada | Alias operativo Medina (`dev` / `staging` / `prod`) | `dev` |
| `API_PREFIX` | No | Prefijo global Nest (`""` o `api/v1`) | `""` hasta decisión |
| `CORS_ORIGINS` | Sí (panel) | Orígenes del frontend (CSV) | `http://localhost:3010` |
| `LOG_LEVEL` | No | `debug` \| `info` \| `warn` \| `error` | `debug` en dev |

### 3.2 Base de datos

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Connection string Postgres con user/db del entorno |
| `DATABASE_URL_DIRECT` | No | URL sin pooler (migraciones Prisma) si se usa pooler en runtime |

Ejemplo forma (no real):  
`postgresql://trescielos:localdev@localhost:5440/trescielos_dev?schema=public`

### 3.3 Cola / Redis

| Variable | Obligatoria | Descripción |
|---|---|---|
| `REDIS_URL` | Condicional* | `redis://localhost:6390` |
| `QUEUE_DRIVER` | No | `bullmq` \| `sqs` \| `inline` (dev sync) **[propuesta]** |
| `INGEST_JOB_TIMEOUT_MS` | No | Alinear a alerta SLA 60 s | p. ej. `60000` |

\* Obligatoria si `QUEUE_DRIVER=bullmq` o worker separado activo.

### 3.4 Auth / sesión panel

| Variable | Obligatoria | Descripción |
|---|---|---|
| `JWT_SECRET` / `SESSION_SECRET` | Sí (panel) | Firma de access token o cookie de sesión |
| `JWT_EXPIRES_IN` | No | Alinear a `expiresIn` de LoginResponse (p. ej. `3600`) |
| `AUTH_COOKIE_NAME` | No | Si se elige cookie httpOnly |
| `AUTH_COOKIE_SECURE` | No | `false` en localhost HTTP; `true` en staging/prod |
| `BCRYPT_ROUNDS` | No | Hash de passwords seed/login | p. ej. `10` |

Shape de claims: `PanelAuthContext` en [../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) §6. Gaps: `refreshToken` / `POST /auth/refresh` / `orgId` en login ([../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md)).

### 3.5 Meta (Messenger / Instagram)

| Variable | Obligatoria* | Descripción |
|---|---|---|
| `META_APP_ID` | Canal Meta | App ID |
| `META_APP_SECRET` | Canal Meta | Verificación de firma |
| `META_VERIFY_TOKEN` | Canal Meta | Challenge webhook GET |
| `META_PAGE_ACCESS_TOKEN` | Canal Meta | Envío saliente (por página/sede según diseño) |

\* Obligatorias solo para probar webhooks Meta; el API puede arrancar sin ellas si los módulos de canal degradan con log claro.

### 3.6 Twilio WhatsApp

| Variable | Obligatoria* | Descripción |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Canal WA | Cuenta |
| `TWILIO_AUTH_TOKEN` | Canal WA | Firma / API |
| `TWILIO_WHATSAPP_FROM` | Canal WA | Sender `whatsapp:+...` |
| `TWILIO_WEBHOOK_AUTH` | Recomendada | Validación de requests Twilio |

### 3.7 IA / RAG

| Variable | Obligatoria* | Descripción |
|---|---|---|
| `LLM_API_KEY` / provider-specific | Orquestador/RAG | Clave del generador |
| `LLM_MODEL` | No | Modelo orquestador / respuesta |
| `EMBEDDINGS_API_KEY` | Ingesta/RAG | Puede coincidir con LLM según vendor |
| `EMBEDDINGS_MODEL` | No | Modelo de embedding indexado |
| `COHERE_API_KEY` | Rerank | Cohere Rerank |
| `RERANK_THRESHOLD` | No | Default producto **`0.85`** |
| `RERANK_TOP_N` | No | Candidatos post-fusión (10–20) → top 3–4 al LLM |

### 3.8 Email / object storage

| Variable | Obligatoria | Descripción |
|---|---|---|
| `SMTP_URL` o `EMAIL_PROVIDER_*` | No en v1 mínimo | Alertas transaccionales |
| `EMAIL_FROM` | Condicional | Remitente |
| `S3_*` / `BLOB_*` | No | PDF/Word/Excel fuente (opcional infra §1) |

### 3.9 Feature / negocio (propuestas de backend)

| Variable | Default | Descripción |
|---|---|---|
| `RERANK_THRESHOLD` | `0.85` | Ver arriba |
| `SLA_ESCALACION_MIN_MINUTES` | `15` | Ventana producto |
| `SLA_ESCALACION_MAX_MINUTES` | `30` | Ventana producto |
| `CUPO_MENSUAL_MENSAJES` | `1000` | Membresía go-live |
| `FF_DEVOLVER_A_BOT` | `false` | API responde 409 si se llama en v1 |
| `ACTIVE_SEDE_SLUG` / id | Jardín 1 | Filtro go-live una sede activa |

Nunca exponer estas claves al frontend (`NEXT_PUBLIC_*` solo URL/API pública — [../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md) §3).

### 3.10 Por entorno

| Entorno | DB / secretos | Canales |
|---|---|---|
| **dev** | Local Docker; JWT débil solo local | Sandbox Meta/Twilio o mocks |
| **staging** | Cluster propio; claves UAT | Cuentas de prueba Tres Cielos |
| **prod** | Backups + rotación Medina | Prod Meta/Twilio; Jardín 1 |

No compartir vectores ni catálogo entre staging y prod (infra §5).

---

## 4. Base de datos: creación, migraciones, seeds

### 4.1 Modelo a persistir

Fuente de verdad conceptual: [../database/01-modelo-conceptual.md](../database/01-modelo-conceptual.md). Catálogo: [../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md). ORM previsto: **Prisma** (infra + DTOs). **No hay `schema.prisma` en el repo.**

Entidades mínimas para un entorno “listo”:

- Org / Sede / Usuario (+ N:M sedes)  
- Lead, Oportunidad, BriefCotizacion, Conversacion, Mensaje  
- Asignacion, Notificacion, EventoOperativo  
- DocumentoFuente, FragmentoVectorial, RegistroRecuperacion  
- Paquete, PaqueteInclusion, PaquetePrecio, PaqueteRegla, ImportacionCatalogo, RegistroConsultaCatalogo  
- ContadorUso / PeriodoCupo  
- GuionPlantilla (metadatos)

### 4.2 Creación del cluster local **[OBJETIVO]**

Pasos previstos (ajustar a `docker-compose` cuando exista):

1. Levantar Postgres con imagen pgvector.  
2. Crear database `tres_cielos_dev` (nombre exacto: por confirmar en compose).  
3. Conectar y habilitar extensiones:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- opcional, útil FTS/fuzzy
-- FTS: usar configuración 'spanish' en columnas tsvector al migrar
```

4. Verificar: `\dx` muestra `vector`.

### 4.3 Migraciones Prisma **[OBJETIVO]**

Comandos esperados (nombres estándar; confirmar en `package.json` al scaffold):

```bash
# Desde apps/api o raíz del workspace
pnpm prisma migrate dev --name init
pnpm prisma generate
```

Reglas:

- Una migración por cambio revisable; aplicar en **cada** entorno (dev/staging/prod) — infra §2.  
- Enums Prisma alineados a [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) §2 (`RolUsuario`, `EtapaPipeline`, `EstadoBot`, …).  
- Columnas `snake_case`; modelos `PascalCase`.  
- Índices: embeddings, GIN `tsvector`, B-tree en filtros operativos.

**Hoy:** no hay migraciones que ejecutar → el criterio de éxito §10 marca scaffold + primera migrate como gate.

### 4.4 Seeds de desarrollo **[OBJETIVO]**

Seed mínimo útil para panel + RBAC (F1–F7):

| Dato | Contenido sugerido |
|---|---|
| `Organizacion` | Tres Cielos |
| `Sede` | Jardín 1 (`activa`); Jardín 2 (`inactiva`) opcional |
| Usuarios | 1 `admin`, 1 `coordinador`, 2 `asesor` (A y B) con passwords documentadas solo en runbook local |
| Catálogo | 1–2 `Paquete` publicados con precio vigente e inclusiones (para tools) |
| Conocimiento | Opcional: 1 FAQ `publicado` + fragmentos (requiere embeddings) o stub sin vector en smoke CRM |
| Cupo | `ContadorUso` del mes en curso con tope 1000 |

Passwords: hash bcrypt; **no** commitear `.env` con secretos reales. Credenciales de demo solo en gestor Medina / doc interno no versionado.

Comando esperado: `pnpm prisma db seed` (configurar `prisma.seed` en package).

### 4.5 Publicación de catálogo vs ingesta documental

| Cambio | Path | Cola |
|---|---|---|
| Precio / paquete publicado | Síncrono DB (Prisma) | Sin embeddings |
| Documento publicado/archivado | Job prioridad alta | Redis/BullMQ (o inline en dev) |

Detalle: [../backend/04-ingesta-conocimiento.md](../backend/04-ingesta-conocimiento.md) §5; inventario K01–K10 en el mismo doc.

---

## 5. Instalación, scripts y arranque local

### 5.1 Situación actual

No hay `package.json` ni scripts. La secuencia siguiente es el **runbook objetivo** post-scaffold.

### 5.2 Secuencia de instalación **[OBJETIVO]**

```bash
# 1. Clonar
git clone <repo-url> TRES-CIELOS-SYS
cd TRES-CIELOS-SYS

# 2. Infra local
docker compose up -d postgres redis   # cuando exista compose

# 3. Dependencias
pnpm install

# 4. Env
cp apps/api/.env.example apps/api/.env
# Editar DATABASE_URL, JWT_SECRET, REDIS_URL, claves opcionales

# 5. DB
pnpm --filter api prisma migrate dev
pnpm --filter api prisma db seed

# 6. Arranque
pnpm --filter api start:dev           # API
pnpm --filter api start:worker:dev    # Worker ingesta (si separado)
```

Nombres de filter/scripts: **placeholder** hasta que el monorepo exista.

### 5.3 Scripts esperados en `apps/api/package.json` **[PROPUESTA]**

| Script | Propósito |
|---|---|
| `start:dev` | Nest watch mode |
| `start:prod` | `node dist/main` |
| `build` | `nest build` / `tsc` |
| `lint` / `test` / `test:e2e` | Calidad |
| `prisma:migrate` / `prisma:generate` / `prisma:seed` | DB |
| `start:worker:dev` | Proceso de cola |

### 5.4 Orden de arranque local

1. Postgres (healthy + extensiones).  
2. Redis (si worker activo).  
3. Migraciones + seed (una vez).  
4. API Nest (`PORT`).  
5. Worker.  
6. (Opcional) panel Next con `NEXT_PUBLIC_API_URL=http://localhost:3011`.

Smoke health (puertos locales fijados):

```bash
curl -sS "http://localhost:3011/health"
```

(Ver checklist completo en [06-checklist-testeo-inicial](06-checklist-testeo-inicial.md).)

### 5.5 Modos de desarrollo degradados

| Modo | Qué enciendes | Qué puedes probar |
|---|---|---|
| **CRM-only** | Postgres + API | Auth, oportunidades, asignación (mocks de canal) |
| **+Cola** | + Redis + worker | Publicación conocimiento (con embeddings reales o mock) |
| **Full** | + Meta/Twilio sandbox + LLM + Cohere | Orquestador end-to-end |

Documentar en logs si falta `COHERE_API_KEY` / canal: no crash silencioso; fail fast al entrar a esa ruta.

---

## 6. Auth y seguridad básica para desarrollo

### 6.1 Contrato (fuente de verdad)

- Login: `POST /auth/login` `{ email, password }` → `{ accessToken, expiresIn, user }` — [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) §4.1.  
- Sesión: `GET /auth/me` → mismo `user`.  
- Guards: `AuthGuard` → `RolesGuard` → `SedeScopeGuard` → `OwnershipGuard` — [../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) §3.  
- Roles: `asesor` \| `coordinador` \| `admin`.  
- Webhooks: **firma Meta/Twilio**, no JWT de panel (`@Public()` + verificador propio).  
- Health: `@Public()`.

### 6.2 Setup de seguridad en dev **[OBJETIVO]**

1. Generar `JWT_SECRET` largo (≥ 32 bytes) solo para máquina local.  
2. Seedear usuarios por rol (asesor A/B, coord, admin) con emails distintos.  
3. Probar:  
   - Login admin → 200 + token.  
   - `GET /carga` con token asesor → **403**.  
   - `GET /conversaciones` asesor A no lista hilos de B (**F1**).  
4. Preferir cookie httpOnly en staging/prod; Bearer aceptable en dev si el panel lo soporta ([../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md)).  
5. Usuario `activo=false`: 401 aunque el JWT no haya expirado.

### 6.3 Gaps de auth a cerrar en kick-off

| Gap | Impacto setup |
|---|---|
| Sin `POST /auth/refresh` / logout en DTOs | Sesiones cortas o solo clear client |
| `orgId` no en LoginResponse | Añadir en `/me` o extender DTO |
| Política única 403 vs 404 en GET de recurso ajeno | Elegir y aplicar en todos los controllers |
| CASL no asumido en v1 | Solo guards documentados |

### 6.4 Checklist implementación auth (extraído de guards §9)

- [ ] Módulo Auth + emisión/validación JWT o sesión  
- [ ] `AuthGuard` global + `@Public()`  
- [ ] `RolesGuard` + `@Roles()`  
- [ ] `SedeScopeGuard` + `OwnershipGuard`  
- [ ] Predicados de listado §5 (no filtrar en memoria)  
- [ ] Tests F1, F6, F7 y 403 en `/carga` / `/telemetria` para asesor  

---

## 7. Health checks y smoke tests post-setup

### 7.1 Endpoints de health **[OBJETIVO — no implementados]**

Propuesta mínima (nombres a fijar en scaffold):

| Método | Path | Auth | Checks |
|---|---|---|---|
| `GET` | `/health` | Público | Proceso up → `{ data: { status: "ok" } }` |
| `GET` | `/health/ready` | Público o red interna | DB ping + (opcional) Redis ping + migraciones aplicadas |
| `GET` | `/health/live` | Público | Liveness (orquestadores k8s) |

No exponer detalles de secretos ni stack traces.

### 7.2 Smoke tests manuales (post-scaffold)

Ejecutar en orden; fallar rápido si el paso previo no pasa.

#### A. Infra

```bash
# Postgres
psql "$DATABASE_URL" -c "SELECT 1; SELECT extname FROM pg_extension WHERE extname = 'vector';"

# Redis (si aplica)
redis-cli -u "$REDIS_URL" PING
```

#### B. API viva

```bash
curl -sS "http://localhost:3011/health"
# Esperado: 200 + envelope data.status=ok
```

#### C. Auth

```bash
curl -sS -X POST "http://localhost:3011/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@local.dev\",\"password\":\"...\"}"
# Esperado: data.accessToken, data.user.rol=admin

curl -sS "http://localhost:3011/auth/me" \
  -H "Authorization: Bearer <token>"
```

#### D. RBAC smoke

```bash
# Token asesor → debe fallar
curl -sS -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <asesorToken>" \
  "http://localhost:3011/carga"
# Esperado: 403
```

#### E. CRM mínimo (si seed creó datos)

- `GET /conversaciones` con envelope lista + `meta`.  
- `GET /oportunidades/:id` dentro de scope.  
- `GET /oportunidades/:id` fuera de ownership asesor → 404 o 403 según política fijada.

#### F. Catálogo / tools (sin LLM)

- Filas `Paquete` `publicado` con precio vigente.  
- Invocar servicio interno `buscar_paquetes` / test unitario — o endpoint admin `GET /catalogo/paquetes`.

#### G. Ingesta (opcional full)

- `POST /conocimiento/documentos/:id/publicar` → job `listo` en &lt; 60 s.  
- Verificar fragmentos activos e invalidación de versión anterior.

#### H. Webhook (sandbox)

- `GET` challenge Meta con `META_VERIFY_TOKEN`.  
- POST firmado de prueba → mensaje persistido + (si bot activo) ruta orquestador registrada en `EventoOperativo`.

### 7.3 Automatización e2e **[PENDIENTE]**

Cuando existan tests: suite `test/e2e/setup.smoke.e2e-spec.ts` que cubra A–E en CI con Postgres service container + pgvector.

---

## 8. Integración con frontend e infra

### 8.1 Frontend (panel Next.js)

| Contrato | Doc |
|---|---|
| Base URL | `NEXT_PUBLIC_API_URL` → API Nest ([../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md)) |
| Paths | [../frontend/05-api-y-hooks.md](../frontend/05-api-y-hooks.md) §2 (`/auth/*`, `/conversaciones`, `/oportunidades`, …) |
| Envelope | Igual que DTOs §1.3 |
| Auth UI | Espejo de guards; **API es autoridad** (F1) |
| Realtime | SSE/WS o polling; F3 ≤ 5 s post-calificación |
| Tipos | `packages/shared` Zod ↔ [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) |

CORS: permitir origen del panel en `CORS_ORIGINS`. Cookies: `credentials` + SameSite si aplica.

**Estado frontend:** tampoco hay código Next ([../frontend/01-estructura.md](../frontend/01-estructura.md)); integrar cuando ambos scaffolds existan.

### 8.2 Infraestructura

| Tema | Doc |
|---|---|
| Componentes lógicos (API, worker, Postgres, storage, email, IA) | [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §1 |
| Jobs y frescura &lt; 60 s | Infra §3; ingesta §5 |
| Entornos dev/staging/prod | Infra §5 |
| Observabilidad + `EventoOperativo` | Infra §6; dominios §10; producto telemetría |
| HTTPS edge, firmas webhook, rate limit | Infra §7 |

Vendor cloud: **no** fijado; el setup local no debe asumir AWS/GCP exclusivos.

### 8.3 Canales ↔ backend

El panel **no** llama webhooks. Solo la API:

- Recibe Meta/Twilio → normaliza → orquestador ([DTOs §4.2](../backend/05-dtos-y-tipos.md)).  
- Responde por el mismo canal de origen.  
- Contabiliza cupo ([dominios §9](../backend/01-dominios.md)).

### 8.4 Puertos locales (fijados tras escaneo 2026-07-28)

| Servicio | Puerto host |
|---|---|
| Next.js `apps/web` | `3010` |
| NestJS `apps/api` | `3011` |
| Postgres | `5440` |
| Redis | `6390` |

Detalle: [05-escaneo-entorno-y-dependencias](05-escaneo-entorno-y-dependencias.md).

---

## 9. Troubleshooting

Problemas que aparecerán **después** del scaffold; hoy el síntoma #0 es “no hay backend que arrancar”.

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| No hay `package.json` / `apps/api` | Repo solo documentación | Ejecutar scaffold Nest+Prisma; no inventar rutas fuera de DTOs |
| `prisma migrate` falla: extension `vector` | Imagen Postgres sin pgvector | Usar imagen `pgvector/pgvector` o instalar extensión en el host |
| API up pero RAG vacío / handoff constante | Sin docs publicados, rerank &lt; 0.85, o sin `COHERE_API_KEY` | Publicar K01/K08/K09; revisar umbral; logs `RegistroRecuperacion` |
| Montos incorrectos en bot | Filas no `publicado` / precio no vigente / tool saltada | Verificar catálogo Prisma; never-path: montos no salen de pgvector ([RAG §1](../backend/03-rag-avanzado.md)) |
| Job de ingesta &gt; 60 s / alerta | Redis caído, cola atrasada, embeddings lentos | `REDIS_URL`, prioridad alta, métricas infra §6 |
| 401 en panel tras login | Cookie Secure en HTTP local; secret mismatch; usuario inactivo | Ajustar `AUTH_COOKIE_SECURE`; mismo `JWT_SECRET`; seed `activo=true` |
| 403 inesperado | Rol/sede/ownership | Revisar matriz [guards §4](../backend/06-guards-y-rbac.md); predicados §5 |
| Asesor ve hilos ajenos | Bug F1 / listado sin filtro | Prioridad P0; tests dos asesores |
| Webhook Meta 403/fail | Verify token o firma | `META_VERIFY_TOKEN` / `META_APP_SECRET`; no usar JWT panel |
| CORS error desde `:3010` | Origen no listado | `CORS_ORIGINS` |
| `orgId` undefined en UI | Gap DTO | Extender `/auth/me` ([frontend auth §1.2](../frontend/06-auth-y-config.md)) |
| Worker no procesa | API y worker no comparten Redis/DB | Misma `REDIS_URL` + `DATABASE_URL` |
| Seed duplicado / unique violation | Re-seed sin reset | `migrate reset` solo en **dev** (destructivo; nunca en prod) |

---

## 10. Criterios de éxito del setup backend

El entorno de desarrollo backend se considera **listo** cuando se cumplen los gates siguientes. Mientras el código no exista, el estado real es **no listo** (documentación solamente).

### 10.1 Gates de scaffold (bloqueantes hoy)

- [ ] Existe `apps/api` (o path equivalente) con NestJS arrancable.  
- [ ] Existe `prisma/schema.prisma` alineado al modelo conceptual + enums DTOs.  
- [ ] Existe `.env.example` del API (sin secretos) cubriendo §3.  
- [ ] Existe compose (o doc equivalente) para Postgres+pgvector (+ Redis).  
- [ ] `docs/README.md` enlaza este setup (mantener índice).

### 10.2 Gates de entorno local

- [ ] `DATABASE_URL` conecta; extensión `vector` habilitada.  
- [ ] Migraciones aplicadas sin error.  
- [ ] Seed crea org, sede activa, usuarios 3 roles, catálogo mínimo.  
- [ ] `GET /health` (o equivalente) → 200.  
- [ ] `POST /auth/login` + `GET /auth/me` con usuario seed.  
- [ ] Smoke RBAC: asesor **403** en `/carga` y `/telemetria`.  
- [ ] CORS permite el origen del panel local.

### 10.3 Gates opcionales (full Agentic RAG)

- [ ] Redis + worker up.  
- [ ] Publicar documento de prueba → fragmentos listos &lt; 60 s.  
- [ ] Tool `obtener_precio_paquete` devuelve precio vigente o `SIN_PRECIO_VIGENTE` (nunca inventado).  
- [ ] Webhook sandbox Meta o Twilio registra mensaje + `EventoOperativo`.

### 10.4 Fuera de alcance del “setup listo”

- Go-live Jardín 1 / UAT Tres Cielos (ver [../producto/02-fases-golive.md](../producto/02-fases-golive.md)).  
- SIEM / guardia 24/7.  
- Segundo jardín activo, drips, BI comercial, widget web.

---

## 11. Referencias cruzadas

### Backend

| Doc | Qué aporta al setup |
|---|---|
| [01-dominios.md](../backend/01-dominios.md) | Comportamientos por dominio a modularizar |
| [02-orquestador-agentico.md](../backend/02-orquestador-agentico.md) | Módulos Nest del cerebro + flujo por mensaje |
| [03-rag-avanzado.md](../backend/03-rag-avanzado.md) | pgvector + FTS + Cohere 0.85; requisitos de env IA |
| [04-ingesta-conocimiento.md](../backend/04-ingesta-conocimiento.md) | Worker, cola, inventario K01–K10, SLA 60 s |
| [05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) | Wire format, enums, auth/login, envelope |
| [06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) | Auth guards, claims, matriz rol×recurso, F1–F7 |

### Database / infra / frontend / producto

| Doc | Qué aporta |
|---|---|
| [../database/01-modelo-conceptual.md](../database/01-modelo-conceptual.md) | Entidades a migrar/seedear |
| [../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md) | Paquetes/precios/tools |
| [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) | Stack, secretos, entornos, jobs |
| [../frontend/01-estructura.md](../frontend/01-estructura.md) | Monorepo `apps/api` + `apps/web` |
| [../frontend/05-api-y-hooks.md](../frontend/05-api-y-hooks.md) | Catálogo HTTP que el API debe exponer |
| [../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md) | Sesión panel, env front, gaps refresh |
| [../producto/02-fases-golive.md](../producto/02-fases-golive.md) | Fases posteriores al setup local |
| [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) | Criterios F1–F7 y telemetría |

### Índice general

[../README.md](../README.md)

---

## Apéndice A — Inventario de gaps (setup)

| ID | Gap | Bloquea |
|---|---|---|
| G1 | Sin código NestJS / Prisma / Docker / `.env.example` | Todo arranque real |
| G2 | Versiones Node/Nest/Prisma no pinneadas | Reproducibilidad |
| G3 | Prefijo `/api/v1` no decidido | Clientes HTTP |
| G4 | Puerto API no fijado en repo | CORS/docs front |
| G5 | Driver de cola (BullMQ vs SQS vs inline) no elegido | Compose Redis |
| G6 | Auth refresh/logout/`orgId` incompletos en DTOs | Sesión larga / claims |
| G7 | Paths admin usuarios/sedes/enrutador sin DTO HTTP detallado | Seed admin UI |
| G8 | DTO de cupo HTTP incompleto (`/cupo`) | Smoke membresía |
| G9 | Health endpoints no especificados en DTOs (solo propuesta aquí) | CI readiness |
| G10 | Worker: mismo app vs `apps/worker` | Scripts de arranque |

Al cerrar cada gap en código, actualizar este documento y tachar el ítem en §10.

---

## Apéndice B — Criterio de cierre de este entregable documental

Quedan documentados: prerrequisitos, estructura objetivo de módulos/dominios, variables de entorno consolidadas, plan DB/migraciones/seeds, runbook de instalación (marcado como pendiente de código), auth de desarrollo, health/smoke, integración front/infra, troubleshooting, criterios de éxito y referencias a `docs/backend/*`. **Implementación en código del backend: 0 %.**
