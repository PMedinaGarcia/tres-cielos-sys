# Setup de infraestructura — Event Master / Tres Cielos

Guía **profunda de setup inicial de infraestructura** para operar el sistema de leads Tres Cielos (Medina Systems): API NestJS, worker de ingesta, panel Next.js, PostgreSQL + pgvector + FTS, colas, proveedores IA y canales Meta/Twilio.

Complementa (no sustituye) el contrato de stack en [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md). Este documento responde a: *cómo levantar, configurar y verificar un entorno operable*.

**Estado del repositorio (2026-07-27):** el workspace contiene **solo documentación** (`docs/`) y la propuesta comercial PDF. **No hay** código de aplicación, `Dockerfile`, `docker-compose`, pipelines CI/CD, Terraform/Pulumi, `vercel.json`, nginx, `.env.example`, ni IaC. Todo lo marcado **Objetivo** es el diseño a implementar; lo **Implementado** se limita a contratos documentados.

---

## Leyenda de estado

| Etiqueta | Significado |
|---|---|
| **Implementado (docs)** | Definido en documentación del repo; listo para construir |
| **Pendiente (código/IaC)** | No existe artefacto en el repo; hay que crearlo en scaffold |
| **Pendiente (cuenta/cloud)** | Requiere cuenta, acceso o recurso externo (cliente o Medina) |
| **Decisión abierta** | Varias opciones válidas; no fijar vendor sin kick-off |

---

## 1. Arquitectura de despliegue: objetivo vs estado actual

### 1.1 Estado actual del workspace

```
TRES-CIELOS-SYS/
├── docs/                    ← único material técnico versionado
│   ├── producto/
│   ├── backend/
│   ├── frontend/
│   ├── database/
│   ├── infrastructure/
│   ├── setup/               ← este documento
│   └── README.md
└── Propuesta_TresCielos_…v1.5.pdf
```

| Artefacto esperado | Estado |
|---|---|
| Monorepo `apps/api`, `apps/web`, `packages/shared` | **Pendiente (código)** — propuesto en [../frontend/01-estructura.md](../frontend/01-estructura.md) §3 |
| Prisma schema + migraciones | **Pendiente (código)** — modelo conceptual en [../database/01-modelo-conceptual.md](../database/01-modelo-conceptual.md) |
| Docker Compose local | **Pendiente (código/IaC)** |
| CI/CD (GitHub Actions u otro) | **Pendiente (código/IaC)** |
| Terraform / Pulumi / CloudFormation | **Pendiente (código/IaC)** — vendor **no amarrado** ([../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md)) |
| Despliegue Vercel / AWS / equivalente | **Pendiente (cuenta/cloud)** + **Decisión abierta** |
| nginx / reverse proxy en repo | **Pendiente (código/IaC)** — en prod suele vivir en el edge del PaaS |

### 1.2 Arquitectura objetivo (lógica)

Alineada a [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §1 y [../frontend/01-estructura.md](../frontend/01-estructura.md) §1:

```
                    ┌─────────────────────────────────────────┐
                    │  Edge HTTPS (CDN / LB / PaaS)           │
                    │  TLS, rate limit básico, CORS panel     │
                    └────────────┬───────────────┬────────────┘
                                 │               │
              Meta / Twilio      │               │  Operadores
              webhooks (firma)   │               │  HTTPS + sesión
                                 ▼               ▼
                          ┌──────────────┐  ┌──────────────┐
                          │  API NestJS  │◄─┤ Panel Next.js│
                          │  (webhooks,  │  │  (App Router)│
                          │   CRM, auth, │  └──────────────┘
                          │   orquest.)  │
                          └──────┬───────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
       ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐
       │ PostgreSQL  │   │ Cola jobs   │   │ Object storage  │
       │ + pgvector  │   │ (Redis/     │   │ (opcional: PDF/ │
       │ + FTS       │   │  BullMQ/SQS)│   │  Word/Excel)    │
       └─────────────┘   └──────┬──────┘   └─────────────────┘
                                │
                                ▼
                         ┌─────────────┐     ┌──────────────────┐
                         │ Worker      │────►│ Embeddings / LLM │
                         │ ingesta     │     │ Cohere Rerank    │
                         └─────────────┘     └──────────────────┘
                                │
                                ▼
                         Email transaccional (alertas asesores)
```

### 1.3 Topología de despliegue recomendada (v1, un jardín)

| Componente | Despliegue típico v1 | Notas |
|---|---|---|
| Panel Next.js | PaaS (p. ej. Vercel) o contenedor | SSR/middleware; `NEXT_PUBLIC_API_URL` → API |
| API NestJS | Contenedor o PaaS Node (ECS, Cloud Run, Railway, Fly, etc.) | Debe exponer URL **pública estable** para webhooks |
| Worker ingesta | Mismo imagen/proceso separado o cola consumida | Prioridad alta en `documento.publicado` ([../backend/04-ingesta-conocimiento.md](../backend/04-ingesta-conocimiento.md)) |
| PostgreSQL | Gestionado (RDS, Cloud SQL, Neon, Supabase, etc.) con **pgvector** | Misma DB para CRM + vectores + FTS en v1 |
| Redis (si BullMQ) | Gestionado o contenedor local | Solo si se elige BullMQ; alternativa SQS/equivalente |
| Object storage | S3-compatible | Opcional v1; fuentes PDF/Word |
| Email | SMTP / Resend / SES / SendGrid | Alertas; no marketing masivo |

**Decisión abierta:** cloud vendor único. La documentación de producto **no exige** AWS, GCP ni Azure; exige comportamiento (HTTPS, backups, secretos separados por entorno, frescura &lt; 60 s).

### 1.4 Escala esperada go-live

De [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §8: un jardín, ~1,000 msgs/mes → footprint pequeño. Cuello de botella típico: latencia LLM/rerank, no CPU del API.

---

## 2. Prerrequisitos

### 2.1 Herramientas de desarrollo (local)

| Herramienta | Uso | Estado |
|---|---|---|
| Node.js LTS (versión exacta al scaffold) | API + panel | **Pendiente** fijar en `engines` / `.nvmrc` |
| pnpm o npm (definir en scaffold) | Monorepo | **Pendiente** |
| Docker Desktop / Engine + Compose v2 | Postgres, Redis, smoke local | **Pendiente (código)** — Compose aún no existe |
| Cliente PostgreSQL (psql / GUI) | Verificar extensiones, migraciones | Recomendado |
| Git | Versionado | Asumido |

### 2.2 CLIs cloud (según vendor elegido)

Instalar **solo** las del stack decidido en kick-off:

| CLI | Cuándo |
|---|---|
| `aws` / `gcloud` / `az` | Si IaC o DB gestionada en ese cloud |
| `vercel` | Si el panel se despliega en Vercel |
| `gh` / CLI del forge | Pipelines y secretos de CI |
| `twilio` | Opcional; útil para números/sandbox WA |
| Terraform o Pulumi CLI | Si se elige IaC declarativa |

**Estado:** ninguna configuración de CLI versionada en el repo.

### 2.3 Cuentas y accesos externos

| Recurso | Para qué | Quién suele proveer | Estado |
|---|---|---|---|
| Meta Business + páginas FB/IG | Webhooks Messenger/IG | Cliente Tres Cielos | **Pendiente (cuenta)** — bloquea Etapa 2 ([../producto/02-fases-golive.md](../producto/02-fases-golive.md) §6) |
| Twilio + WhatsApp Business | Canal WA, plantillas utility | Cliente / Medina | **Pendiente (cuenta)** — Etapa 9 |
| Proveedor LLM + embeddings | Orquestador + ingesta | Medina | **Pendiente (cuenta)** |
| Cohere (Rerank) | Umbral 0.85 | Medina | **Pendiente (cuenta)** — [../backend/03-rag-avanzado.md](../backend/03-rag-avanzado.md) §4 |
| SMTP / email transaccional | Alertas | Medina | **Pendiente (cuenta)** |
| Dominio + DNS | `api.*`, `app.*` | Medina / cliente | **Pendiente (cuenta)** |
| Gestor de secretos | Prod/staging | Medina (runbook) | **Pendiente (cuenta)** |

### 2.4 Secretos — prerrequisito de gobernanza

Antes del primer deploy a staging/prod:

1. Definir **gestor** (Vault, AWS Secrets Manager, Doppler, variables del PaaS, etc.) — **Decisión abierta**.
2. Política: **cero secretos en git**; rotación documentada en runbook Medina ([../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §4).
3. Separar claves **dev / staging / prod** (Meta/Twilio de prueba ≠ producción; vectores/catálogo no compartidos entre entornos).

---

## 3. Entornos: local, staging, producción

### 3.1 Matriz de entornos

| Entorno | Propósito | Datos | Canales | Panel banner |
|---|---|---|---|---|
| **local (dev)** | Desarrollo diario | DB local / compose; seed sintético | Webhooks vía tunnel (ngrok/cloudflared) o mocks | `NEXT_PUBLIC_APP_ENV=development` |
| **staging** | UAT con Tres Cielos | Copia controlada / seed UAT; **no** prod | Apps Meta/Twilio de **prueba** | `staging` — banner no productivo recomendado |
| **production** | Go-live Jardín 1 | Prod real; backups | Credenciales **producción** | `production` |

Fuente: [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §5; env panel en [../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md) §3.2.

### 3.2 Reglas de aislamiento (obligatorias)

1. **Una `DATABASE_URL` por entorno** — nunca apuntar staging al cluster de prod.
2. **Biblioteca de conocimiento y catálogo independientes** — no reutilizar embeddings de staging en prod.
3. **Claves Meta/Twilio por entorno** — verify tokens y page tokens distintos.
4. **Usuarios panel:** cuentas UAT ≠ operadores reales de prod (o mismos emails con passwords/roles controlados y auditados).
5. **Feature flags** más restrictivos en prod hasta UAT firmado ([../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md) §4).

### 3.3 Sede operativa por entorno

En go-live: **solo Jardín 1 activo** ([../producto/02-fases-golive.md](../producto/02-fases-golive.md) G7). En staging puede existir Jardín 2 inactivo para pruebas de filtro de sede. Configuración de `Sede.estado` es dato de dominio, no de DNS.

### 3.4 Nombres de host sugeridos (ilustrativos)

| Entorno | Panel | API |
|---|---|---|
| local | `http://localhost:3000` | `http://localhost:3001` (o puerto Nest) |
| staging | `https://app.staging.<dominio>` | `https://api.staging.<dominio>` |
| prod | `https://app.<dominio>` | `https://api.<dominio>` |

Dominios reales: **Pendiente (cuenta/cloud)**. CORS y cookies deben alinearse a estos orígenes (§8).

---

## 4. Servicios

### 4.1 Base de datos — PostgreSQL + pgvector + FTS

| Requisito | Detalle | Estado |
|---|---|---|
| Motor | PostgreSQL compatible con Prisma | **Implementado (docs)** |
| Extensión `vector` | Embeddings / hybrid search | **Implementado (docs)** — falta provisionar |
| FTS | `tsvector` / config español recomendada | **Implementado (docs)** |
| Migraciones | Prisma por entorno | **Pendiente (código)** |
| Índices | IVFFlat/HNSW; GIN; B-tree en `estado`, `sede_id`, `vigente_*` | **Implementado (docs)** |
| Backups | Automatizados + retención comercial | **Pendiente (cuenta/cloud)** |
| Separación lógica v1 | Mismo cluster: CRM + catálogo + fragmentos | Aceptable ([../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §2) |

**Criterio de readiness DB:** `CREATE EXTENSION IF NOT EXISTS vector;` OK; migración Prisma aplicada; conexión desde API y worker con rol de mínimo privilegio.

### 4.2 Caché / cola de trabajos

| Opción | Uso | Estado |
|---|---|---|
| Redis + BullMQ | Cola ingesta documental, prioridad alta publicación | **Decisión abierta** / **Pendiente** |
| SQS / Cloud Tasks / equivalente | Misma semántica de jobs | Alternativa válida |

SLA producto: publicación → bot usa versión nueva en **&lt; 60 s** ([../backend/04-ingesta-conocimiento.md](../backend/04-ingesta-conocimiento.md)). Timeout/reintentos + alerta admin si se supera ([../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §3).

Publicación de **catálogo/precios**: path síncrono DB (sin cola de embeddings).

Caché de fragmentos: TTL corto o key = `documento_version_id`; preferible no cachear agresivamente.

### 4.3 Object storage

| Uso | Obligatorio v1 |
|---|---|
| Conservar PDF/Word/Excel originales subidos por admin | **Opcional** |
| Entregar archivos al worker de parseo | Si no hay storage, se puede persistir en DB/blob temporal — no recomendado a escala |

Proveedor: S3, GCS, R2, etc. — **Decisión abierta**.

### 4.4 Email / SMS

| Canal | Alcance v1 | Estado |
|---|---|---|
| Email **transaccional** | Alertas: nuevo, calificado, escalación (± listo_para_cotizar) | Requerido si el acuerdo de alerta lo incluye ([../backend/01-dominios.md](../backend/01-dominios.md) §7) |
| SMS / email marketing / push | **Fuera de alcance** | No provisionar |
| WhatsApp | Canal de leads vía Twilio, no “SMS genérico” | Etapa 9 |

### 4.5 Proveedores de IA

| Servicio | Rol | Config clave |
|---|---|---|
| Embeddings | Ingesta + query vectorial | Dimensión fija al indexar; no mezclar modelos entre entornos sin reindex |
| LLM | Orquestador / generación anclada | Prompt estricto ([../backend/03-rag-avanzado.md](../backend/03-rag-avanzado.md) §5) |
| Cohere Rerank | Scores 0–1; umbral default **0.85** | `COHERE_API_KEY`; umbral override por env |

### 4.6 Canales de mensajería

| Canal | Autenticación infra | Notas |
|---|---|---|
| Meta (FB/IG) | Verify token + firma de app | Rutas `@Public()` con verificación propia ([../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) §1) |
| Twilio WhatsApp | Firma webhook Twilio | Mismo cerebro agentico |

### 4.7 Monitoring / observabilidad

Ver §9. Vendor (Grafana Cloud, Datadog, CloudWatch, etc.): **Decisión abierta**. Contrato de dominio: logs estructurados + métricas + `EventoOperativo` en DB ([../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) §7). No sustituye SIEM ni guardia 24/7.

---

## 5. Docker Compose / contenedores (objetivo)

**Estado:** **Pendiente (código/IaC)** — no hay `Dockerfile` ni `docker-compose*.yml` en el repo.

### 5.1 Compose local propuesto (referencia de scaffold)

Servicios mínimos para desarrollo:

```yaml
# Ilustrativo — aún no versionado en el repo
services:
  postgres:
    image: pgvector/pgvector:pg16   # o postgres + install extension
    environment:
      POSTGRES_USER: trescielos
      POSTGRES_PASSWORD: localdev
      POSTGRES_DB: trescielos_dev
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U trescielos"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:                             # solo si BullMQ
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 10

  # api / worker / web: preferible `pnpm dev` en host en v1 local;
  # contenedorizar cuando exista scaffold estable.
volumes:
  pgdata:
```

### 5.2 Imágenes de aplicación (objetivo)

| Imagen | Contenido | Notas |
|---|---|---|
| `api` | NestJS API | Multi-stage build; no empaquetar `.env` |
| `worker` | Mismo codebase, comando worker | Misma imagen, `CMD` distinto, o target separado |
| `web` | Next.js standalone o build PaaS | En Vercel suele no hacer falta imagen propia |

### 5.3 Healthchecks de contenedor

| Servicio | Check propuesto |
|---|---|
| `postgres` | `pg_isready` |
| `redis` | `PING` |
| `api` | `GET /health` o `/healthz` (**Pendiente** endpoint) |
| `worker` | Heartbeat / métrica de cola (o liveness del proceso) |

Rutas health: públicas vía `@Public()` ([../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md)); panel: `/login` y assets son públicos ([../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md) §2.1).

### 5.4 Compose en staging/prod

**No** se recomienda Compose como orquestador de producción salvo PaaS que lo asuma. Preferir servicios gestionados + containers orquestados o PaaS. Compose = **dev parity** de DB/Redis.

---

## 6. CI/CD pipelines

**Estado:** **Pendiente (código/IaC)** — no existe `.github/workflows/`, GitLab CI, ni equivalente.

### 6.1 Pipeline objetivo (referencia)

```
push / PR
  → lint + typecheck (api, web, shared)
  → unit / contract tests (guards, DTOs Zod, orquestador mock)
  → build api + web
  → (opcional) migrate dry-run / prisma validate
  → artifact / image push
deploy staging (manual o auto en main)
  → migrate deploy
  → smoke /health + login UAT
deploy prod (manual con aprobación)
  → migrate deploy
  → smoke + checklist go-live parcial
```

### 6.2 Gates recomendados

| Gate | Motivo |
|---|---|
| PR checks verdes | Evitar romper monorepo |
| Migraciones revisadas | Cambios pgvector/índices son sensibles |
| No secretos en diff | Escaneo básico |
| Deploy prod con aprobación humana | Membresía / canales reales |
| Post-deploy smoke webhooks (staging) | Verificar firma + 200 |

### 6.3 Qué no automatizar sin cuidado

- Apuntar webhooks Meta/Twilio de **prod** a URLs de staging.
- Correr seed destructivo en prod.
- Publicar conocimiento/catálogo de UAT hacia prod vía job compartido.

### 6.4 Relación con fases de producto

CI/CD habilita Etapas 2–7; el **go-live** sigue siendo checklist humano ([../producto/02-fases-golive.md](../producto/02-fases-golive.md) §5). Infra “verde” ≠ UAT firmado.

---

## 7. Secretos y configuración por entorno

### 7.1 Backend / worker (conceptual)

Nombres ilustrativos alineados a [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §4:

| Variable | Dev | Staging | Prod | Notas |
|---|---|---|---|---|
| `NODE_ENV` | `development` | `production` | `production` | |
| `APP_ENV` | `development` | `staging` | `production` | Distinguir staging de prod en logs |
| `DATABASE_URL` | local compose | cluster staging | cluster prod | Incluir SSL mode según vendor |
| `REDIS_URL` | local | staging | prod | Si BullMQ |
| `JWT_SECRET` / session | local débil OK | fuerte | fuerte + rotación | Nunca reutilizar entre envs |
| `META_APP_SECRET` | app test | app test/UAT | app prod | |
| `META_VERIFY_TOKEN` | local/tunnel | staging | prod | Challenge webhook |
| `META_PAGE_ACCESS_TOKEN` | test | UAT | prod | |
| `TWILIO_ACCOUNT_SID` | sandbox | test | prod | |
| `TWILIO_AUTH_TOKEN` | sandbox | test | prod | Validación firma |
| `TWILIO_WHATSAPP_FROM` | sandbox | test | prod | |
| `OPENAI_API_KEY` u otro LLM | clave dev | staging | prod | Preferible proyectos separados |
| `EMBEDDING_MODEL` / dims | fijo | mismo o documentar reindex | fijo | |
| `COHERE_API_KEY` | sí | sí | sí | |
| `RERANK_THRESHOLD` | `0.85` | `0.85` | `0.85` | Override solo con acuerdo UAT |
| `SMTP_*` / `EMAIL_API_KEY` | Mailhog/local | proveedor test | prod | |
| `STORAGE_BUCKET` / keys | opcional | sí si uploads | sí | |
| `CORS_ORIGINS` | `http://localhost:3000` | URL panel staging | URL panel prod | Lista explícita |
| `PUBLIC_API_URL` | tunnel URL | `https://api.staging…` | `https://api…` | Para callbacks/docs |
| `RATE_LIMIT_WEBHOOK_*` | laxo | medio | prod | [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §7 |

### 7.2 Frontend (panel)

Solo lo documentado en [../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md) §3:

| Variable | Ámbito |
|---|---|
| `NEXT_PUBLIC_API_URL` | public |
| `NEXT_PUBLIC_API_PREFIX` | public |
| `NEXT_PUBLIC_APP_ENV` | public |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `es-MX` |
| `NEXT_PUBLIC_SLA_ESCALACION_MIN` / `_MAX` | `15` / `30` |
| `NEXT_PUBLIC_REALTIME_URL` | vacío = polling |
| `NEXT_PUBLIC_FEATURE_*` / `FF_*` | flags |
| `API_INTERNAL_URL` | server-only SSR |
| `SESSION_SECRET` | server-only si BFF verifica JWT |

**Prohibido en frontend:** `DATABASE_URL`, Meta/Twilio, `COHERE_API_KEY`, LLM keys.

### 7.3 Artefactos aún inexistentes

| Artefacto | Estado |
|---|---|
| `.env.example` (api + web) | **Pendiente (código)** — checklist frontend §7 |
| Secretos en CI | **Pendiente** |
| Documentación de rotación en runbook Medina | **Pendiente (cuenta)** fuera del repo o addendum |

### 7.4 Reglas operativas

1. Inyectar secretos en runtime (PaaS / orchestrator), no bake en imagen.
2. Auditar quién tiene acceso a prod Meta/Twilio.
3. Tras rotación de `JWT_SECRET`, forzar re-login (gap refresh documentado en frontend §1.4).

---

## 8. Redes, dominios, SSL, CORS

### 8.1 Superficies de red

| Superficie | Exposición | Auth |
|---|---|---|
| Panel Next.js | Pública HTTPS | Sesión/JWT operadores |
| API panel (`/auth`, CRM, …) | Pública HTTPS (o privada + mismo edge) | JWT/cookie + RBAC |
| Webhooks Meta/Twilio | Pública HTTPS | Firma proveedor (`@Public` + verify) |
| Worker | **Privada** (VPC / red interna) | Credenciales de cola/DB |
| Postgres / Redis | **Privada** | Usuario mínimo privilegio |
| Object storage | Privada + URLs firmadas si hace falta | IAM / keys |

### 8.2 TLS / SSL

- Terminar HTTPS en el **edge** ([../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §7).
- Certificados gestionados por PaaS/CDN (Let's Encrypt, ACM, etc.).
- Cookies de sesión: `Secure` + `HttpOnly` + `SameSite` adecuado ([../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md) §1.3).

**Estado:** **Pendiente (cuenta/cloud)** — sin dominios ni certs en repo.

### 8.3 CORS

| Caller | Política |
|---|---|
| Panel → API | Allowlist exacta de origen del panel por entorno |
| Webhooks | No usan CORS de browser; son server-to-server |
| Credenciales cookie | `Access-Control-Allow-Credentials: true` + origen explícito (nunca `*`) |

Si panel y API son **same-site** bajo un reverse proxy (`app.` + `api.` sibling), simplifica cookies; si cross-site, planificar CSRF ([../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md) §5).

### 8.4 DNS y webhooks

1. Crear registros `A`/`CNAME` para panel y API.
2. Configurar URL de callback Meta/Twilio → `https://api…/webhooks/...`.
3. En local: tunnel (ngrok, Cloudflare Tunnel) apuntando al puerto Nest; actualizar verify token del entorno **dev** solamente.
4. Rate limiting básico en paths de webhook.

### 8.5 nginx / reverse proxy

**Pendiente.** Si el PaaS no aporta edge propio, un nginx (o Traefik/Caddy) puede:

- Terminar TLS
- Enrutar `/` → web, `/api` → Nest (si se unifica host)
- Headers de seguridad (`HSTS`, etc.)

No hay configs versionadas hoy; al añadirlas, mantenerlas fuera de secretos.

---

## 9. Observabilidad (logs, métricas, healthchecks)

### 9.1 Logs de infraestructura

Estructurados (JSON preferible), correlacionables por `requestId` / `conversationId` / `jobId`:

| Dominio | Qué loguear |
|---|---|
| Webhooks | Recepción, verificación firma OK/FAIL, latencia |
| Orquestador | Ruta elegida (guion / tools / RAG / handoff) |
| Tools / RAG | SKUs, fragment IDs, rerank scores |
| Ingesta | Inicio/fin job, duración, errores parse/embed |
| Auth panel | Login fail sin filtrar existencia de email; 401/403 |

Retención: según acuerdo membresía; PII mínima necesaria.

### 9.2 Métricas

| Métrica | Uso |
|---|---|
| Latencia respuesta bot | SLO operativo |
| Tasa de handoff | Calidad RAG/guion |
| Duración jobs publicación | Vigilancia SLA 60 s |
| Errores proveedores IA / Cohere | Alertas |
| Profundidad / edad cola ingesta | Alerta si &gt; 60 s |
| Fallo sostenido webhooks | Alerta operativa |

### 9.3 Telemetría de producto (en base de datos)

Además de APM externo, persistir `EventoOperativo` (bot + humano) — [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) §7; superficie panel Telemetría ([../frontend/00-superficies.md](../frontend/00-superficies.md)). Criterio UAT **F7**.

### 9.4 Healthchecks y readiness

| Endpoint / check | Debe verificar |
|---|---|
| `GET /health` (liveness) | Proceso vivo |
| `GET /ready` (readiness) | DB reachable; opcional Redis; **no** llamar LLM en cada probe |
| Panel | Respuesta HTTP 200 en `/login` |
| Worker | Proceso up + consumo de cola (métrica) |

**Estado:** contratos de dominio **Implementados (docs)**; endpoints y dashboards **Pendientes (código/cloud)**.

### 9.5 Alertas mínimas v1

1. Webhooks fallando de forma sostenida.
2. Cola de ingesta atrasada (&gt; 60 s al “listo”).
3. Error sostenido LLM/rerank.
4. (Producto) Escalaciones sin atención humana fuera de ventana 15–30 min — vía telemetría/panel, no necesariamente PagerDuty.

Fuera de alcance: SIEM enterprise, guardia 24/7 ([../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §6).

---

## 10. Procedimiento de setup inicial (paso a paso)

Procedimiento **objetivo** para el primer entorno usable (local → staging). Marcar cada paso al implementar.

### Fase A — Kick-off de infraestructura (1–2 días)

1. **Confirmar vendor** (compute, DB, panel hosting, secretos, email, storage). Documentar decisión en addendum o actualizar este §1.3.
2. **Crear cuentas** LLM, Cohere, email; solicitar accesos Meta/Twilio al cliente ([../producto/02-fases-golive.md](../producto/02-fases-golive.md) §6).
3. **Reservar dominios** staging y prod; plan DNS.
4. **Provisionar gestor de secretos** y convención de nombres (§7).

### Fase B — Scaffold de repo (bloqueante hoy)

5. Crear monorepo (`apps/api`, `apps/web`, `packages/shared`) según [../frontend/01-estructura.md](../frontend/01-estructura.md).
6. Añadir `docker-compose.yml` (§5) + `.env.example` (api/web).
7. Prisma schema inicial alineado a [../database/01-modelo-conceptual.md](../database/01-modelo-conceptual.md) + extensión pgvector.
8. Endpoints `@Public()`: health + stubs de webhook.
9. Pipeline CI mínimo (§6).

### Fase C — Entorno local

10. Instalar prerrequisitos (§2.1).
11. `docker compose up -d` (Postgres ± Redis).
12. Verificar: `pgvector` instalado; `SELECT extname FROM pg_extension;`.
13. Configurar `.env` local (nunca commit).
14. Migrar DB; seed: org Tres Cielos, Sede Jardín 1 activa, Jardín 2 inactiva, usuarios por rol.
15. Levantar API + worker + web; login panel; `GET /health` OK.
16. (Opcional) Tunnel + Meta test app para un mensaje de prueba.

### Fase D — Staging

17. Provisionar Postgres gestionado + pgvector; Redis/cola; storage si aplica.
18. Desplegar API + worker + panel; configurar `CORS_ORIGINS` y cookies Secure.
19. Cargar secretos staging (Meta/Twilio **test**, LLM, Cohere, SMTP).
20. `prisma migrate deploy`; seed UAT.
21. Registrar webhooks Meta/Twilio → URL staging; validar firma.
22. Smoke: mensaje test → bandeja; publicar doc K01 → job &lt; 60 s; email de alerta si aplica.
23. Checklist parcial UAT infra (§11) antes de UAT de producto completo.

### Fase E — Producción (solo post-UAT firmado)

24. Provisionar stack prod **aislado**.
25. Dominios + TLS + backups verificados (restore test al menos una vez).
26. Secretos **prod**; webhooks **prod**; Jardín 1 activo.
27. Deploy con aprobación; migraciones; smoke controlado.
28. Cumplir criterios G1–G11 de producto ([../producto/02-fases-golive.md](../producto/02-fases-golive.md) §5) — infra es necesario pero no suficiente.

### Orden sugerido respecto al producto

```
Infra local ──► Scaffold app ──► Staging + canales test ──► UAT (Etapa 7)
                                                              │
                                                              ▼
                                                         Prod Jardín 1
```

No retrasar inventario K01–K10 y catálogo: pueden cargarse en staging en paralelo ([../backend/04-ingesta-conocimiento.md](../backend/04-ingesta-conocimiento.md)).

---

## 11. Criterios de éxito de infraestructura

Un entorno se considera **listo y operable** cuando se cumplen **todos** los ítems aplicables a ese entorno.

### 11.1 Local — checklist

- [ ] Compose (o DB local) con PostgreSQL + **pgvector** + FTS usable
- [ ] API responde health; worker consume cola (o path síncrono documentado)
- [ ] Panel abre login y habla con API (`NEXT_PUBLIC_API_URL`)
- [ ] Migraciones aplicables desde cero
- [ ] Seed mínimo (org, sede activa, 3 roles)
- [ ] `.env.example` existe; ningún secreto en git
- [ ] CORS local permite el origen del panel

### 11.2 Staging — checklist

- [ ] HTTPS en panel y API; certificados válidos
- [ ] Secretos solo en gestor/PaaS; distintos de prod
- [ ] Webhooks Meta (y Twilio si en alcance) verifican firma y escriben conversación de prueba
- [ ] Job de publicación documental completa en &lt; 60 s con alerta si falla
- [ ] Email transaccional de prueba entregado (si canal acordado)
- [ ] Cohere rerank responde; umbral 0.85 configurable
- [ ] Backups staging opcionales pero restore procedure documentado
- [ ] Logs estructurados visibles; al menos una alerta de prueba disparable
- [ ] RBAC: usuario asesor no ve datos de otro (smoke F1)
- [ ] Banner/env `staging` visible para operadores UAT

### 11.3 Producción — checklist

- [ ] Todo lo de staging, con claves y datos **prod**
- [ ] Backups automatizados + **prueba de restore** exitosa
- [ ] Red: DB/Redis/worker no expuestos a Internet
- [ ] Rate limit en webhooks
- [ ] Deploy con aprobación; rollback documentado (imagen/release anterior)
- [ ] Jardín 1 activo / Jardín 2 no operativo a nivel de datos
- [ ] Runbook Medina: rotación secretos, contacto incidentes P2/P3 membresía
- [ ] Observabilidad: dashboards mínimos o queries equivalentes + alertas §9.5
- [ ] Go-live de **producto** no se declara solo con este checklist — requiere [../producto/02-fases-golive.md](../producto/02-fases-golive.md) §5

### 11.4 Definición binaria “infra OK”

| Nivel | Definición |
|---|---|
| **Infra local OK** | Dev puede iterar API/panel/DB sin dependencias cloud |
| **Infra staging OK** | Tres Cielos puede hacer UAT de canales y panel con datos no productivos |
| **Infra prod OK** | Stack aislado, seguro, respaldado y observable listo para tráfico real Jardín 1 |

---

## 12. Referencias cruzadas

### Infraestructura y setup

| Doc | Relación |
|---|---|
| [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) | Contrato de componentes, secretos, entornos, observabilidad, seguridad |
| Este archivo (`03-infraestructura-setup.md`) | Procedimiento de levantamiento, Compose/CI objetivo, checklists |

### Producto y go-live

| Doc | Relación |
|---|---|
| [../producto/02-fases-golive.md](../producto/02-fases-golive.md) | Etapas 1–9, UAT, G1–G11, bloqueos por accesos cliente |
| [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) | F1–F7, `EventoOperativo`, SLA 15–30 min |
| [../producto/01-diseno-estrategico.md](../producto/01-diseno-estrategico.md) | Un jardín activo, embudo |
| [../README.md](../README.md) | Índice general del sistema |

### Backend / datos / panel

| Doc | Relación |
|---|---|
| [../backend/01-dominios.md](../backend/01-dominios.md) | Canales, notificaciones, cupo, integraciones |
| [../backend/02-orquestador-agentico.md](../backend/02-orquestador-agentico.md) | Cerebro único Meta/WA |
| [../backend/03-rag-avanzado.md](../backend/03-rag-avanzado.md) | pgvector + FTS + Cohere |
| [../backend/04-ingesta-conocimiento.md](../backend/04-ingesta-conocimiento.md) | Worker, frescura &lt; 60 s, K01–K10 |
| [../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) | Webhooks ≠ JWT; health público |
| [../database/01-modelo-conceptual.md](../database/01-modelo-conceptual.md) | Entidades a migrar |
| [../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md) | Path síncrono de precios |
| [../frontend/01-estructura.md](../frontend/01-estructura.md) | Monorepo y stack panel |
| [../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md) | Env vars panel, cookies, CORS/CSRF |

### Fuente comercial

[Propuesta_TresCielos_SistemaLeads_MedinaSystems_v1.5.pdf](../../Propuesta_TresCielos_SistemaLeads_MedinaSystems_v1.5.pdf)

---

## 13. Gaps conocidos (resumen ejecutivo)

| # | Gap | Impacto |
|---|---|---|
| G-I1 | Sin código ni IaC en el repo | No se puede “levantar” el sistema solo con este doc |
| G-I2 | Vendor cloud / PaaS no elegido | Bloquea dominios, secretos, pipelines concretos |
| G-I3 | Sin Docker Compose / Dockerfiles | Dev parity DB/Redis no estandarizada |
| G-I4 | Sin CI/CD | Sin gates de calidad ni deploy reproducible |
| G-I5 | Sin `.env.example` | Onboarding frágil |
| G-I6 | Sin endpoints `/health` `/ready` | Orquestadores y UAT infra incompletos |
| G-I7 | Cola: BullMQ vs SQS no decidido | Afecta Compose y secretos |
| G-I8 | Object storage opcional sin política | Riesgo de ad-hoc en uploads |
| G-I9 | Accesos Meta/Twilio/cliente | Bloquean Etapas 2 y 9 aunque staging esté listo |
| G-I10 | Refresh/logout auth aún con gaps de contrato | Afecta cookies cross-env ([../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md)) |
| G-I11 | `docs/README.md` aún no indexa carpeta `setup/` | Descubrimiento; actualizar cuando exista suite setup completa |
| G-I12 | Versiones exactas Node/Next/Postgres | Por fijar en scaffold |

---

## 14. Criterio de cierre de este entregable

Quedan documentados, de forma operable para implementación:

1. Arquitectura objetivo vs estado real del workspace  
2. Prerrequisitos (herramientas, CLIs, cuentas, gobernanza de secretos)  
3. Matriz y reglas de entornos  
4. Servicios (DB, cola, storage, email, IA, canales, monitoring)  
5. Compose/contenedores **propuestos** (marcados pendientes)  
6. CI/CD **propuesto**  
7. Tablas de configuración por entorno  
8. Redes, TLS, CORS, DNS/webhooks  
9. Observabilidad y healthchecks  
10. Procedimiento paso a paso A–E  
11. Checklists binarios local / staging / prod  
12. Referencias cruzadas y registro de gaps  

**Implementado en código/IaC: 0 %.** Este documento es el contrato de setup de infraestructura hasta el scaffold.
