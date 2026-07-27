# Event Master System — Tres Cielos

Documentación del sistema integrado de gestión de leads (CRM + chatbot Meta/WhatsApp + asignación). Stack de referencia: NestJS, Next.js, Prisma, PostgreSQL + PG Vector + Full Text Search.

**Arquitectura de producto del bot:** Agentic RAG (orquestador con Function Calling a catálogo Prisma, búsqueda híbrida documental, rerank, prompts estrictos y handoff a humano). No es un agente libre multi-día ni drips autónomos.

## Índice por dominio

### Producto

| Doc | Contenido |
|---|---|
| [01 — Diseño estratégico](producto/01-diseno-estrategico.md) | Embudo, campos mínimos, calificación, sedes, brief de cotización |
| [02 — Fases y go-live](producto/02-fases-golive.md) | Etapas 1–9, UAT, criterio de go-live Jardín 1 |
| [03 — Criterios de éxito de cotización](producto/03-criterios-exito-cotizacion.md) | `listo_para_cotizar`, métricas UAT, ramo eventos sociales |
| [04 — Escenarios por rol, carga y telemetría](producto/04-escenarios-rol-carga-telemetria.md) | UX por rol, enrutador, carga multi-asesor, F1–F7, telemetría bot+humano |

### Backend

| Doc | Contenido |
|---|---|
| [01 — Dominios](backend/01-dominios.md) | Comportamientos NestJS por dominio de negocio |
| [02 — Orquestador agentico](backend/02-orquestador-agentico.md) | Routing guion / tools / RAG / handoff |
| [03 — RAG avanzado](backend/03-rag-avanzado.md) | Hybrid search, rerank, prompts anti-alucinación |
| [04 — Ingesta de conocimiento](backend/04-ingesta-conocimiento.md) | Parseo, inventario K, publicación y frescura &lt; 60 s |
| [05 — DTOs y tipos](backend/05-dtos-y-tipos.md) | Enums, DTOs request/response, shapes JSON y anti-alucinación |
| [06 — Guards y RBAC](backend/06-guards-y-rbac.md) | Auth/Roles/Sede/Ownership, matriz acceso, claims, F1–F7 |

### Frontend

| Doc | Contenido |
|---|---|
| [00 — Superficies](frontend/00-superficies.md) | Bandeja, carga multi-asesor, telemetría operativa, matriz por perfil |
| [01 — Estructura](frontend/01-estructura.md) | Stack, monorepo, carpetas, entrypoints (contrato; sin código aún) |
| [02 — Routing y páginas](frontend/02-routing-y-paginas.md) | Rutas App Router, layouts, nav y gates de rol (UI) |
| [03 — Componentes](frontend/03-componentes.md) | Composición UI, tokens, features por superficie |
| [04 — Estado y datos](frontend/04-estado-y-datos.md) | Query cache, contextos, realtime/polling, flujos de datos |
| [05 — API y hooks](frontend/05-api-y-hooks.md) | Cliente HTTP, endpoints↔DTOs, hooks por dominio |
| [06 — Auth y config](frontend/06-auth-y-config.md) | Sesión/JWT, middleware, env, feature flags |
| [07 — Tipos](frontend/07-tipos.md) | Zod/shared, alineación con DTOs backend, view models |

### Base de datos

| Doc | Contenido |
|---|---|
| [01 — Modelo conceptual](database/01-modelo-conceptual.md) | Entidades CRM, conversación, `EventoOperativo`, conocimiento, catálogo |
| [02 — Catálogo de paquetes](database/02-catalogo-paquetes.md) | Paquetes, precios, inclusiones, rules y tools |

### Infraestructura

| Doc | Contenido |
|---|---|
| [01 — Stack y entornos](infrastructure/01-stack-y-entornos.md) | Postgres/pgvector/FTS, workers, secretos, entornos |

### Setup

| Doc | Contenido |
|---|---|
| [00 — Índice](setup/00-indice.md) | Entrada a setup y criterios de éxito |
| [01 — Frontend setup](setup/01-frontend-setup.md) | Prerrequisitos, env, tooling, API, arranque y checklist UI |
| [02 — Backend setup](setup/02-backend-setup.md) | Prerrequisitos, env, DB/migraciones/seeds, arranque, auth dev, health/smoke |
| [03 — Infraestructura setup](setup/03-infraestructura-setup.md) | Entornos, servicios, Compose/CI, secretos, red/SSL, observabilidad |
| [04 — Criterios de éxito](setup/04-criterios-de-exito.md) | DoD de producto, MoSCoW, UAT, go-live Jardín 1, evidencias |

### GitHub

| Doc | Contenido |
|---|---|
| [00 — Índice](github/00-indice.md) | Entrada a la carpeta GitHub y lectura recomendada |
| [01 — Repositorio y clonado](github/01-repositorio-y-clonado.md) | Identidad del remoto, clone, estructura vs workspace |
| [02 — Flujo de trabajo y PRs](github/02-flujo-trabajo-y-prs.md) | Ramas, commits, reviews, protección en el flujo diario |
| [03 — Actions CI/CD](github/03-actions-ci-cd.md) | Pipelines, triggers, checks, deploy staging/prod |
| [04 — Entornos, secretos y gobierno](github/04-entornos-secretos-gobierno.md) | Environments, secretos (nombres), OIDC, rulesets, seguridad, go-live |

## Fuente comercial

[Propuesta_TresCielos_SistemaLeads_MedinaSystems_v1.5.pdf](../Propuesta_TresCielos_SistemaLeads_MedinaSystems_v1.5.pdf)

## Lectura recomendada

1. Producto (diseño → criterios de cotización → roles/carga/telemetría → fases)
2. Database (modelo + catálogo) en paralelo con Backend (dominios → orquestador → RAG → ingesta → DTOs/tipos → guards/RBAC)
3. Frontend (superficies → estructura → routing → componentes → estado/datos → API/hooks → auth/config → tipos)
4. Infraestructura (stack y entornos)
5. Setup ([índice](setup/00-indice.md): frontend → backend → infra → [criterios de éxito](setup/04-criterios-de-exito.md)) al preparar entorno y cerrar go-live
6. GitHub ([índice](github/00-indice.md): repo/clonado → flujo/PRs → Actions CI/CD → [gobierno y secretos](github/04-entornos-secretos-gobierno.md)) al operar el remoto y gates de merge/deploy
