# Setup — Índice

Documentación de arranque y **criterios de éxito del producto** Event Master System (Tres Cielos / Medina Systems). Complementa el índice general en [../README.md](../README.md).

| # | Documento | Alcance |
|---|---|---|
| 01 | [Frontend setup](01-frontend-setup.md) | Scaffold Next.js, monorepo UI, env, auth de panel, routing base |
| 02 | [Backend setup](02-backend-setup.md) | Scaffold NestJS, Prisma, módulos de dominio, webhooks, workers |
| 03 | [Infraestructura setup](03-infraestructura-setup.md) | Entornos, Postgres/pgvector, secretos, observabilidad, despliegue |
| 04 | [Criterios de éxito](04-criterios-de-exito.md) | Definition of Done de producto, MoSCoW, UAT, go-live, evidencias; D-MED / DoD multimodal → [backend/09](../backend/09-aceptacion-y-matriz-tests.md) |
| 05 | [Escaneo entorno y dependencias](05-escaneo-entorno-y-dependencias.md) | Snapshot workspace, puertos locales, inventario pinneado |
| 06 | [Checklist testeo inicial](06-checklist-testeo-inicial.md) | Checklists A–L (incl. smoke multimodal objetivo) y gates FE/BE/infra |
| 07 | [Railway deploy](07-railway-deploy.md) | Servicios web/api/Postgres/Redis en Railway |
| 08 | [Sandbox catálogo XLS](08-sandbox-catalogo-xls.md) | Contexto tipado del agente (Excel → tools) |
| 09 | [Criterios salida producción chatbot](09-criterios-salida-produccion-chatbot.md) | Gate go-live Agentic RAG: C3/C5/C4, D-BOT/D-MED, UAT firmable, rollback, NO-GO |

## Contratos Fase Doc (multimodal / IA) — lectura cruzada

Documentación de contrato **antes** de implementar código de la vertical Agentic RAG multimodal:

| Doc | Para qué |
|---|---|
| [../backend/07-pipeline-openai-y-proveedores.md](../backend/07-pipeline-openai-y-proveedores.md) | Proveedores OpenAI + Cohere, ports, env |
| [../backend/08-ingesta-multimodal.md](../backend/08-ingesta-multimodal.md) | MediaRouter, MIME, SLAs foto/video |
| [../backend/09-aceptacion-y-matriz-tests.md](../backend/09-aceptacion-y-matriz-tests.md) | D-MED / UI-KNW / T-MED, pirámide tests |
| [../backend/10-plan-implementacion-chatbot.md](../backend/10-plan-implementacion-chatbot.md) | Plan de ejecución Agentic RAG (fases A–F, Nest, PRs) |
| [../database/03-assets-y-fragmentos-multimodales.md](../database/03-assets-y-fragmentos-multimodales.md) | Modelo `Asset`, enums, invariantes |
| [../frontend/08-cableado-conocimiento-multimodal.md](../frontend/08-cableado-conocimiento-multimodal.md) | Upload panel, poll job, hooks, RBAC UI |
| [../frontend/09-plan-implementacion-chatbot-ui.md](../frontend/09-plan-implementacion-chatbot-ui.md) | Plan UI chatbot / conversación |
| [../infrastructure/02-plan-implementacion-chatbot-infra.md](../infrastructure/02-plan-implementacion-chatbot-infra.md) | Plan infra API+worker+BullMQ+S3+observabilidad |
| [09-criterios-salida-produccion-chatbot.md](09-criterios-salida-produccion-chatbot.md) | Gate go-live bot (este corte de aceptación) |

## Cómo usar esta carpeta

1. **Escaneo + testeo (05–06):** verificar máquina, puertos y smoke del scaffold.
2. **Setup (01–03):** dejar el stack ejecutable en `dev` / `staging` / `prod` (puertos locales: web **3010**, api **3011**, Postgres **5440**, Redis **6390**).
3. **Railway + sandbox (07–08):** desplegar PaaS y pipeline de catálogo para el agente.
4. **Criterios (04 + 09):** decidir si el producto construido es el esperado; cerrar UAT y go-live Jardín 1; el **gate del chatbot** Agentic RAG está en [09](09-criterios-salida-produccion-chatbot.md).
5. Ante conflicto entre setup y criterios, gana el contrato de producto en `docs/producto/` y dominios en `docs/backend/`, `docs/frontend/`, `docs/database/`.
6. Ante la vertical multimodal: cerrar **Fase Doc** (tabla arriba) antes de código en `apps/`.
7. **Infra chatbot:** plan ordenado en [../infrastructure/02-plan-implementacion-chatbot-infra.md](../infrastructure/02-plan-implementacion-chatbot-infra.md) (API+worker+BullMQ+S3+observabilidad).

## Lectura recomendada antes de go-live

1. [04-criterios-de-exito.md](04-criterios-de-exito.md) (DoD de producto completo)
2. [09-criterios-salida-produccion-chatbot.md](09-criterios-salida-produccion-chatbot.md) — gate go-live del bot (C3/C5/C4, rollback, NO-GO)
3. [../producto/02-fases-golive.md](../producto/02-fases-golive.md) — G1–G11 y checklist UAT
4. [../producto/03-criterios-exito-cotizacion.md](../producto/03-criterios-exito-cotizacion.md) — C1–C7
5. [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) — F1–F7
6. Contratos Fase Doc (backend/07–09, database/03, frontend/08) si se valida ingesta multimodal
7. [../infrastructure/02-plan-implementacion-chatbot-infra.md](../infrastructure/02-plan-implementacion-chatbot-infra.md) — fases infra I0–I6
