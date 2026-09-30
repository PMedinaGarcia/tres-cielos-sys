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

### Negocio / conocimiento comercial

Corpus modular de lo que Tres Cielos vende (inclusiones Julio 2026 + **tarifas Paquete Bodas 2027**). Índice: [negocio/00-indice.md](negocio/00-indice.md). Archivos ingestibles: [`fixtures/negocio/`](../fixtures/negocio/README.md).

| Doc | Contenido |
|---|---|
| [00 — Índice](negocio/00-indice.md) | Mapa humano, cómo versionar ediciones, enlace al corpus |
| [01 — Universo comercial](negocio/01-universo-comercial.md) | Tres líneas, Anexo B, catálogo vs K, límites del bot |
| [02 — Ediciones y vigencias](negocio/02-ediciones-y-vigencias.md) | Relojes catálogo / cotización / promoción; schema futuro |
| [03 — Matriz de líneas](negocio/03-matriz-lineas.md) | Premium vs TC vs Solo renta (deltas) |
| [04 — Inventario K de negocio](negocio/04-inventario-k-negocio.md) | K01–K16, anti-monto, composición de módulos |
| [05 — Pendientes de validación](negocio/05-pendientes-validacion.md) | Renta, sede, aforos intermedios |
| [06 — Tarifas Paquete Bodas 2027](negocio/06-tarifas-bodas-2027.md) | Tramos estándar/Premium, temporada baja, pago |

### Backend

| Doc | Contenido |
|---|---|
| [01 — Dominios](backend/01-dominios.md) | Comportamientos NestJS por dominio de negocio |
| [02 — Orquestador agentico](backend/02-orquestador-agentico.md) | Routing guion / tools / RAG / handoff; gate precio OCR; adjuntos |
| [03 — RAG avanzado](backend/03-rag-avanzado.md) | Hybrid search, rerank, prompts anti-alucinación |
| [04 — Ingesta de conocimiento](backend/04-ingesta-conocimiento.md) | Parseo, inventario K, publicación y frescura (SLAs por tipo) |
| [05 — DTOs y tipos](backend/05-dtos-y-tipos.md) | Enums, DTOs request/response, shapes JSON y anti-alucinación |
| [06 — Guards y RBAC](backend/06-guards-y-rbac.md) | Auth/Roles/Sede/Ownership, matriz acceso, claims, F1–F7 |
| [07 — Pipeline OpenAI y proveedores](backend/07-pipeline-openai-y-proveedores.md) | SDK OpenAI, Cohere, ports/adapters, cupo tokens, anti-alcance |
| [08 — Ingesta multimodal](backend/08-ingesta-multimodal.md) | MediaRouter MIME, parsers, SLAs foto/video, storage, allowlist |
| [09 — Aceptación y matriz de tests](backend/09-aceptacion-y-matriz-tests.md) | D-MED-*, UI-KNW-*, T-MED-*, ports, fixtures knowledge, CI vs `@live` |
| [10 — Plan implementación chatbot](backend/10-plan-implementacion-chatbot.md) | Fases A–F, módulos Nest, ports, `POST /orchestrator/turn`, PRs, cierre Agentic RAG |

### Frontend

| Doc | Contenido |
|---|---|
| [00 — Superficies](frontend/00-superficies.md) | Bandeja, carga multi-asesor, telemetría operativa, matriz por perfil |
| [01 — Estructura](frontend/01-estructura.md) | Stack, monorepo, carpetas, entrypoints (`apps/web` scaffold) |
| [02 — Routing y páginas](frontend/02-routing-y-paginas.md) | Rutas App Router, layouts, nav y gates de rol (UI) |
| [03 — Componentes](frontend/03-componentes.md) | Composición UI, tokens, features por superficie |
| [04 — Estado y datos](frontend/04-estado-y-datos.md) | Query cache, contextos, realtime/polling, flujos de datos |
| [05 — API y hooks](frontend/05-api-y-hooks.md) | Cliente HTTP, endpoints↔DTOs, hooks por dominio |
| [06 — Auth y config](frontend/06-auth-y-config.md) | Sesión/JWT, middleware, env, feature flags |
| [07 — Tipos](frontend/07-tipos.md) | Zod/shared, alineación con DTOs backend, view models |
| [08 — Cableado conocimiento multimodal](frontend/08-cableado-conocimiento-multimodal.md) | Upload multipart, poll `pipelineEstado`, hooks, UI-KNW, RBAC |
| [09 — Plan implementación chatbot UI](frontend/09-plan-implementacion-chatbot-ui.md) | Bandeja, handoff, brief, telemetría bot, fases FE, F1–F7, tests |

### Base de datos

| Doc | Contenido |
|---|---|
| [01 — Modelo conceptual](database/01-modelo-conceptual.md) | Entidades CRM, conversación, `EventoOperativo`, conocimiento, catálogo |
| [02 — Catálogo de paquetes](database/02-catalogo-paquetes.md) | Paquetes, precios, inclusiones, rules y tools |
| [03 — Assets y fragmentos multimodales](database/03-assets-y-fragmentos-multimodales.md) | `Asset`, `TipoMaterial`, `PipelineEstado`, invariantes anti-alucinación |

### Infraestructura

| Doc | Contenido |
|---|---|
| [01 — Stack y entornos](infrastructure/01-stack-y-entornos.md) | Postgres/pgvector/FTS, **object storage obligatorio**, worker ffmpeg, secretos OpenAI/Cohere/S3; PaaS **Railway** |
| [02 — Plan implementación chatbot infra](infrastructure/02-plan-implementacion-chatbot-infra.md) | Fases I0–I6: API+worker+BullMQ+pgvector+S3, secretos, observabilidad, capacity ~1k msgs, CI/Railway, riesgos RPO/RTO |

### Setup

| Doc | Contenido |
|---|---|
| [00 — Índice](setup/00-indice.md) | Entrada a setup y criterios de éxito |
| [01 — Frontend setup](setup/01-frontend-setup.md) | Prerrequisitos, env, tooling, API, arranque y checklist UI |
| [02 — Backend setup](setup/02-backend-setup.md) | Prerrequisitos, env, DB/migraciones/seeds, arranque, auth dev, health/smoke |
| [03 — Infraestructura setup](setup/03-infraestructura-setup.md) | Entornos, servicios, Compose/CI, secretos, red/SSL, observabilidad |
| [04 — Criterios de éxito](setup/04-criterios-de-exito.md) | DoD de producto, MoSCoW, UAT, go-live Jardín 1, evidencias |
| [05 — Escaneo entorno y dependencias](setup/05-escaneo-entorno-y-dependencias.md) | Puertos locales, inventario monorepo, gaps |
| [06 — Checklist testeo inicial](setup/06-checklist-testeo-inicial.md) | Smoke Compose/API/web/sandbox, gates planificación, **§L multimodal/fixtures knowledge** |
| [07 — Railway deploy](setup/07-railway-deploy.md) | Runbook web + api + Postgres + Redis |
| [08 — Sandbox catálogo XLS](setup/08-sandbox-catalogo-xls.md) | Excel → Zod → Prisma → tools (contexto agente) |
| [09 — Criterios salida producción chatbot](setup/09-criterios-salida-produccion-chatbot.md) | Gate go-live bot (C3/C5/C4, D-BOT, D-MED), UAT firmable, rollback, NO-GO |

### GitHub

| Doc | Contenido |
|---|---|
| [00 — Índice](github/00-indice.md) | Entrada a la carpeta GitHub y lectura recomendada |
| [01 — Repositorio y clonado](github/01-repositorio-y-clonado.md) | Identidad del remoto, clone, estructura vs workspace |
| [02 — Flujo de trabajo y PRs](github/02-flujo-trabajo-y-prs.md) | Ramas, commits, reviews, protección en el flujo diario |
| [03 — Actions CI/CD](github/03-actions-ci-cd.md) | Pipelines, triggers, checks, deploy staging/prod |
| [04 — Entornos, secretos y gobierno](github/04-entornos-secretos-gobierno.md) | Environments, secretos (nombres), OIDC, rulesets, seguridad, go-live |

## Fuente comercial

[Propuesta_TresCielos_SistemaLeads_MedinaSystems_v1.6.pdf](../Propuesta_TresCielos_SistemaLeads_MedinaSystems_v1.6.pdf) (02-sep-2026; reemisión de [v1.5](../Propuesta_TresCielos_SistemaLeads_MedinaSystems_v1.5.pdf))

## Fase Doc (multimodal / Agentic RAG)

Los docs `backend/07–09`, `database/03` y `frontend/08` son el contrato de **ingesta multimodal e IA**. El plan de ejecución del cerebro está en [backend/10 — Plan implementación chatbot](backend/10-plan-implementacion-chatbot.md); el plan de panel/conversación UI está en [frontend/09 — Plan implementación chatbot UI](frontend/09-plan-implementacion-chatbot-ui.md). Esta documentación es **previa a la implementación de código** en `apps/` (salvo Health + CatalogSandbox); el gate de Fase Doc bloquea arrancar esa vertical hasta cerrar el checklist del plan.

## Lectura recomendada

1. Producto (diseño → criterios de cotización → roles/carga/telemetría → fases) y, en paralelo, [negocio](negocio/00-indice.md) (líneas comerciales, ediciones, inventario K)
2. Database (modelo + catálogo + assets multimodales) en paralelo con Backend (dominios → orquestador → RAG → ingesta → DTOs → guards → pipeline OpenAI → multimodal → aceptación/tests → **[plan implementación chatbot](backend/10-plan-implementacion-chatbot.md)**)
3. Frontend (superficies → … → tipos → cableado conocimiento multimodal → **[plan implementación chatbot UI](frontend/09-plan-implementacion-chatbot-ui.md)**)
4. Infraestructura ([stack](infrastructure/01-stack-y-entornos.md) → [plan chatbot infra](infrastructure/02-plan-implementacion-chatbot-infra.md))
5. Setup ([índice](setup/00-indice.md): frontend → backend → infra → [criterios de éxito](setup/04-criterios-de-exito.md) → [salida prod chatbot](setup/09-criterios-salida-produccion-chatbot.md)) al preparar entorno y cerrar go-live
6. GitHub ([índice](github/00-indice.md): repo/clonado → flujo/PRs → Actions CI/CD → [gobierno y secretos](github/04-entornos-secretos-gobierno.md)) al operar el remoto y gates de merge/deploy
