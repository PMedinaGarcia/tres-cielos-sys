# Escaneo de entorno y dependencias

Snapshot del workspace y del entorno de trabajo local al momento del scaffold mínimo (2026-07-28). Complementa [01-frontend-setup](01-frontend-setup.md), [02-backend-setup](02-backend-setup.md) y [03-infraestructura-setup](03-infraestructura-setup.md).

## 1. Estado del repositorio (pre / post scaffold)

| Elemento | Antes del scaffold | Después (este entregable) |
|---|---|---|
| Código `apps/` / `packages/` | Ausente | `apps/web`, `apps/api`, `packages/shared` |
| Lockfile / `package.json` | Ausente | pnpm workspace + lockfile |
| Docker Compose | Solo ilustrativo en docs | `docker-compose.yml` ejecutable |
| `.env.example` | Solo plantillas en markdown | Archivos reales en raíz y apps |
| PaaS | Decisión abierta | **Railway** (ver [07-railway-deploy](07-railway-deploy.md)) |
| Sandbox catálogo XLS | Contrato en database/ | Fixtures + Zod + seed/eval (ver [08](08-sandbox-catalogo-xls.md)) |

## 2. Escaneo de puertos (máquina de desarrollo)

Escaneo de puertos en escucha (Windows, 2026-07-28). Objetivo: no chocar con servicios ya activos.

### 2.1 Ocupados (evitar en local)

`3000`, `3003`, `3005`, `5432`, `5433`, `5434`, `5436`, `6379`, `6380`, `8000`, `4566`.

### 2.2 Mapa Tres Cielos (libres confirmados)

| Servicio | Host local | Contenedor interno | Notas |
|---|---|---|---|
| Next.js `apps/web` | **3010** | — | `next dev -p 3010` |
| NestJS `apps/api` | **3011** | — | `PORT=3011` |
| Postgres + pgvector | **5440** | `5432` | Compose `ports: "5440:5432"` |
| Redis | **6390** | `6379` | Compose `ports: "6390:6379"` |

En Railway los puertos públicos los asigna la plataforma; las apps escuchan `PORT` inyectado.

### 2.3 Cómo re-escanear

```powershell
Get-NetTCPConnection -State Listen |
  Select-Object -ExpandProperty LocalPort |
  Sort-Object -Unique |
  Where-Object { $_ -lt 10000 }
```

Si alguno del mapa 3010/3011/5440/6390 pasa a ocupado, actualizar Compose, `.env.example` y esta sección en el mismo PR.

## 3. Inventario de dependencias pinneadas (scaffold)

Package manager: **pnpm** workspaces. Runtime: **Node.js 22** (`engines`).

### 3.1 Frontend (`apps/web`)

| Paquete | Rol |
|---|---|
| `next` ^15 | App Router |
| `react` / `react-dom` ^19 | UI |
| `typescript` ^5 | Tipado |
| `tailwindcss` ^3 | Estilos |
| `zod` (vía `@tres-cielos/shared`) | Contratos compartidos |
| `@tanstack/react-query` ^5 | Datos cliente (preparado) |

Scripts: `dev` (puerto 3010), `build`, `start`, `lint`, `typecheck`.

### 3.2 Backend (`apps/api`)

| Paquete | Rol |
|---|---|
| `@nestjs/common` / `core` / `platform-express` ^11 | API HTTP |
| `@nestjs/config` | Env |
| `prisma` / `@prisma/client` ^6 | ORM + migraciones |
| `exceljs` | Parse XLS/XLSX del sandbox |
| `zod` / `@tres-cielos/shared` | Validación CatalogSnapshot |
| `class-validator` / `class-transformer` | DTOs Nest |
| `ioredis` | Ping Redis en `/health/ready` (opcional) |

Scripts: `dev`, `build`, `start:prod`, `prisma:*`, `sandbox:seed`, `sandbox:eval`.

### 3.3 Shared (`packages/shared`)

| Paquete | Rol |
|---|---|
| `zod` ^3 | `CatalogSnapshot`, enums, shapes de tools |

### 3.4 Infraestructura local

| Imagen / servicio | Versión / tag |
|---|---|
| `pgvector/pgvector:pg16` | Postgres 16 + extensión `vector` |
| `redis:7-alpine` | Redis 7 |
| Docker Compose | v2 |

Cola v0: `QUEUE_DRIVER=inline`. Redis provisionado para BullMQ en fases posteriores.

## 4. Variables de entorno (resumen local)

Ver `.env.example` en la raíz del monorepo.

| Variable | Valor local típico |
|---|---|
| `PORT` | `3011` |
| `CORS_ORIGINS` | `http://localhost:3010` |
| `DATABASE_URL` | `postgresql://trescielos:localdev@localhost:5440/trescielos_dev?schema=public` |
| `REDIS_URL` | `redis://localhost:6390` |
| `QUEUE_DRIVER` | `inline` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3011` |
| `NEXT_PUBLIC_APP_ENV` | `development` |

## 5. Gaps cerrados vs abiertos

### Cerrados con este scaffold

| Gap | Resolución |
|---|---|
| Sin código ejecutable | Monorepo mínimo |
| Vendor PaaS abierto (G-I2) | Railway documentado y configurado |
| Sin Compose real | `docker-compose.yml` |
| Sin `.env.example` | Plantillas versionadas |
| Puertos en conflicto local | Mapa 3010/3011/5440/6390 |
| Sandbox XLS solo conceptual | Fixtures + seed/eval + doc 08 |

### Siguen abiertos (desarrollo posterior)

- Auth completa, Meta/Twilio, RAG, Cohere, workers BullMQ.
- UI de upload Excel en panel.
- Cuentas LLM / Meta / Twilio / email.
- CI GitHub Actions materializado.
- Deploy real a cuenta Railway del equipo (runbook listo; requiere token).

## 6. Referencias

- [06-checklist-testeo-inicial](06-checklist-testeo-inicial.md)
- [07-railway-deploy](07-railway-deploy.md)
- [08-sandbox-catalogo-xls](08-sandbox-catalogo-xls.md)
- [../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md)
