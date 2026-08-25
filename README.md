# tres-cielos-sys

Event Master System (Tres Cielos / Medina Systems) — monorepo scaffold.

## Stack

- `apps/web` — Next.js (panel) en puerto **3010**
- `apps/api` — NestJS + Prisma en puerto **3011**
- `packages/shared` — Zod / `CatalogSnapshot`
- Postgres+pgvector **5440**, Redis **6390** (Docker Compose)
- PaaS: **Railway** — ver [docs/setup/07-railway-deploy.md](docs/setup/07-railway-deploy.md)

## Arranque rápido

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm --filter @tres-cielos/api prisma:migrate
pnpm --filter @tres-cielos/api sandbox:seed
pnpm --filter @tres-cielos/api sandbox:eval
pnpm --filter @tres-cielos/api dev
# otra terminal
pnpm --filter @tres-cielos/web dev
```

Checklist: [docs/setup/06-checklist-testeo-inicial.md](docs/setup/06-checklist-testeo-inicial.md)  
Documentación: [docs/README.md](docs/README.md)
