# Setup — Índice

Documentación de arranque y **criterios de éxito del producto** Event Master System (Tres Cielos / Medina Systems). Complementa el índice general en [../README.md](../README.md).

| # | Documento | Alcance |
|---|---|---|
| 01 | [Frontend setup](01-frontend-setup.md) | Scaffold Next.js, monorepo UI, env, auth de panel, routing base |
| 02 | [Backend setup](02-backend-setup.md) | Scaffold NestJS, Prisma, módulos de dominio, webhooks, workers |
| 03 | [Infraestructura setup](03-infraestructura-setup.md) | Entornos, Postgres/pgvector, secretos, observabilidad, despliegue |
| 04 | [Criterios de éxito](04-criterios-de-exito.md) | Definition of Done de producto, MoSCoW, UAT, go-live, evidencias |

## Cómo usar esta carpeta

1. **Setup (01–03):** dejar el stack ejecutable en `dev` / `staging` / `prod`.
2. **Criterios (04):** decidir si el producto construido es el esperado; cerrar UAT y go-live Jardín 1.
3. Ante conflicto entre setup y criterios, gana el contrato de producto en `docs/producto/` y dominios en `docs/backend/`, `docs/frontend/`, `docs/database/`.

## Lectura recomendada antes de go-live

1. [04-criterios-de-exito.md](04-criterios-de-exito.md) (este entregable de aceptación)
2. [../producto/02-fases-golive.md](../producto/02-fases-golive.md) — G1–G11 y checklist UAT
3. [../producto/03-criterios-exito-cotizacion.md](../producto/03-criterios-exito-cotizacion.md) — C1–C7
4. [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) — F1–F7
