# GitHub Actions / CI-CD — Tres Cielos Sys

Contrato **profundo** de continuous integration y continuous delivery para el repositorio remoto [`PMedinaGarcia/tres-cielos-sys`](https://github.com/PMedinaGarcia/tres-cielos-sys). Complementa (no sustituye) el bosquejo de pipelines en [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) §6 y el stack en [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md).

**Fecha de inspección remota:** 2026-07-27 (vía `gh api`).  
**Workspace local:** documentación en `docs/`; sin código de aplicación ni `.github/workflows/` en el workspace.

| Etiqueta | Significado |
|---|---|
| **Real** | Verificado en el remoto o en el workspace en la fecha de inspección |
| **Objetivo** | Diseño a implementar cuando exista scaffold monorepo |
| **Decisión abierta** | Requiere kick-off (vendor PaaS, gestor de secretos, etc.) |

---

## 1. Estado actual de Actions en el remoto

### 1.1 Hechos verificados (`gh api`)

| Aspecto | Valor real |
|---|---|
| Repo | `PMedinaGarcia/tres-cielos-sys` (público) |
| Default branch | `main` |
| Contenido del árbol raíz | Solo `README.md` (`# tres-cielos-sys`) |
| Commit más reciente | `2afc30c` — *Initial commit* (2026-07-27) |
| Carpeta `.github/` | **No existe** (API contents → HTTP 404) |
| `.github/workflows/` | **No existe** |
| Workflows registrados | `total_count: 0` |
| Runs de Actions | `total_count: 0` |
| Caches de Actions | `total_count: 0` |
| Environments (`staging` / `production`) | `total_count: 0` |
| Branch protection en `main` | **No configurada** |
| Rulesets | `[]` (ninguno) |
| Actions habilitadas a nivel repo | `enabled: true`, `allowed_actions: all` |
| SHA pinning de actions | `sha_pinning_required: false` |

### 1.2 Interpretación

1. GitHub Actions **está habilitado** en el repo, pero **no hay ningún pipeline** que ejecutar.
2. No hay status checks posibles que marcar como *required* hoy (no hay jobs).
3. El workspace de documentación (`TRES-CIELOS-SYS`) y el remoto no están sincronizados en contenido de producto: el remoto es un skeleton; el workspace local concentra `docs/` (y la propuesta PDF). Cualquier workflow se añadirá al remoto cuando exista scaffold + `.github/workflows/*.yml`.
4. Alineado a [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) gap **G-I4**: sin CI/CD no hay gates de calidad ni deploy reproducible.

### 1.3 Comandos de re-verificación

```bash
gh api repos/PMedinaGarcia/tres-cielos-sys/actions/workflows
gh api repos/PMedinaGarcia/tres-cielos-sys/actions/runs --jq ".total_count"
gh api repos/PMedinaGarcia/tres-cielos-sys/contents/.github/workflows
gh api repos/PMedinaGarcia/tres-cielos-sys/environments
gh api repos/PMedinaGarcia/tres-cielos-sys/branches/main/protection
```

---

## 2. Pipelines objetivo

Alineados al monorepo propuesto (`apps/api`, `apps/web`, `packages/shared`) en [../frontend/01-estructura.md](../frontend/01-estructura.md) §3 y scripts esperados en setup frontend/backend (`lint`, `typecheck`, `test`, `build`, Prisma).

### 2.1 Vista de flujo

```
PR / push main / tag / workflow_dispatch
        │
        ▼
┌───────────────────┐
│  ci (calidad)     │
│  lint             │
│  typecheck        │
│  test (unit)      │
│  build FE + BE    │
│  prisma validate  │
│  migrate dry-run  │  ← service container Postgres+pgvector
│  docker build     │  ← api (± worker) ; web si no es solo Vercel
└─────────┬─────────┘
          │
          ├─► deploy-staging  (push main o manual; environment staging)
          │         migrate deploy → smoke /health + /login
          │
          └─► deploy-production (tag v* o manual; environment production + aprobación)
                    migrate deploy → smoke + checklist parcial
```

### 2.2 Catálogo de jobs (objetivo)

| Job ID | Qué hace | Package / scope | Bloqueante PR |
|---|---|---|---|
| `lint` | ESLint (y Prettier check si se adopta) | raíz / matrix `api`, `web`, `shared` | Sí |
| `typecheck` | `tsc --noEmit` o script `typecheck` | matrix por package | Sí |
| `test` | Unit + contract (Zod, guards, orquestador mock) | `api`, `shared`; `web` cuando exista suite | Sí |
| `build-api` | `nest build` / build del package `api` | `apps/api` | Sí |
| `build-web` | `next build` | `apps/web` | Sí |
| `prisma-validate` | `prisma validate` + `prisma generate` | schema en `apps/api` (o `packages/db`) | Sí |
| `migrate-dry-run` | Aplicar migraciones en DB efímera CI (equivalente a “dry-run operable”) | service `pgvector/pgvector` | Sí (cuando existan migraciones) |
| `docker` | Build multi-stage imágenes `api` (± `worker`); opcional `web` | Dockerfiles objetivo | Sí en PR que toque Docker/api; o siempre tras scaffold estable |
| `deploy-staging` | Deploy + `prisma migrate deploy` + smoke | environment `staging` | N/A (no en PR) |
| `deploy-production` | Deploy con aprobación + migrate + smoke | environment `production` | N/A |

**Nota sobre “migrate dry-run”:** Prisma no tiene un flag universal `migrate dry-run` idéntico a Flyway. El contrato objetivo es:

1. Levantar Postgres+pgvector en el job.
2. `prisma migrate deploy` contra esa DB vacía (o `migrate diff` / `validate` según versión).
3. Fallar el job si la migración no aplica desde cero.

No ejecutar `migrate deploy` contra staging/prod desde el workflow de PR.

### 2.3 Qué no meter en CI v1 sin cuidado

Tomado de [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) §6.3:

- Apuntar webhooks Meta/Twilio de **prod** a URLs de staging.
- Seeds destructivos en prod.
- Jobs que publiquen conocimiento/catálogo UAT hacia prod.
- Llamadas reales a LLM/Cohere/Meta en cada PR (usar mocks; opcional job nightly con secretos de *dev*).

### 2.4 Archivos YAML objetivo (aún inexistentes)

```
.github/
├── workflows/
│   ├── ci.yml                 # lint, typecheck, test, build, prisma, docker
│   ├── deploy-staging.yml     # push main y/o workflow_dispatch
│   └── deploy-production.yml  # tags v* y/o workflow_dispatch + approval
├── CODEOWNERS                 # opcional
└── dependabot.yml             # opcional (actions + npm)
```

**Estado:** **Pendiente (código)** — ningún archivo de la lista existe en el remoto ni en el workspace.

---

## 3. Triggers

### 3.1 Matriz de disparadores (objetivo)

| Evento | Workflow | Condición | Propósito |
|---|---|---|---|
| `pull_request` | `ci.yml` | hacia `main` (y ramas de release si existen) | Gates de merge |
| `push` | `ci.yml` | `branches: [main]` | Validar main post-merge |
| `push` | `deploy-staging.yml` | `branches: [main]` tras CI verde | Staging continuo (**Decisión abierta:** auto vs manual) |
| `push` tags `v*` | `deploy-production.yml` | SemVer `vX.Y.Z` | Release prod |
| `workflow_dispatch` | staging y prod | Inputs: ref, skip_migrate?, dry_smoke? | Operación Medina / hotfix |
| `workflow_dispatch` | `ci.yml` | opcional | Re-run calidad sin commit |

### 3.2 Paths filters (recomendado)

Para monorepo, evitar builds innecesarios en PRs docs-only:

| Paths | Jobs a ejecutar |
|---|---|
| `docs/**`, `*.md`, PDF comercial | Opcional: job mínimo `docs-lint` o **skip** CI de app |
| `apps/api/**`, `packages/shared/**`, lockfile, Prisma | `lint/typecheck/test/build-api` + prisma + docker api |
| `apps/web/**`, `packages/shared/**` | `lint/typecheck/test/build-web` |
| `Dockerfile*`, `docker-compose*`, `.github/workflows/**` | CI completo + docker |

**Cuidado:** un cambio en `packages/shared` debe invalidar matrix de **api y web**.

### 3.3 Concurrencia

```yaml
# Ilustrativo — objetivo
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true   # en PR
```

Para deploy prod: `cancel-in-progress: false` y un solo deploy a la vez por environment.

---

## 4. Matrix / jobs alineados al monorepo

### 4.1 Estructura de monorepo (contrato)

```
apps/api          # NestJS + Prisma + worker entrypoint
apps/web          # Next.js panel
packages/shared   # Zod / enums / PanelAuthContext
```

Gestor de paquetes **preferido en docs de setup:** pnpm workspaces (± Turborepo). Versión exacta de Node: **gap** hasta `.nvmrc` / `engines` en scaffold ([../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) G-I12).

### 4.2 Matrix recomendada

```yaml
# Ilustrativo — objetivo en ci.yml
strategy:
  fail-fast: false
  matrix:
    package: [api, web, shared]
```

| Matrix cell | Scripts esperados (nombres placeholder) |
|---|---|
| `api` | `pnpm --filter api lint`, `typecheck`, `test`, `build` |
| `web` | `pnpm --filter web lint`, `typecheck`, `test`, `build` |
| `shared` | `pnpm --filter shared lint`, `typecheck`, `test` |

Jobs **fuera de matrix** (necesitan servicios o Docker):

| Job | Runner | Servicios |
|---|---|---|
| `migrate-dry-run` | `ubuntu-latest` | `pgvector/pgvector:pg16` (o pg15/16 fijado en scaffold) |
| `test-e2e-api` (fase 2) | `ubuntu-latest` | Postgres + Redis si BullMQ |
| `docker` | `ubuntu-latest` | Buildx; sin push en PR; push a registry en main/tag |

### 4.3 Orden de dependencias entre jobs

```
setup (checkout, pnpm cache, install)
   ├── lint (matrix)
   ├── typecheck (matrix)     ← needs: setup
   ├── test (matrix)
   ├── prisma-validate
   │      └── migrate-dry-run (needs prisma-validate + postgres healthy)
   ├── build-api / build-web (needs typecheck)
   └── docker (needs build-api; opcional needs migrate-dry-run)
```

`deploy-*` solo si `ci` completo en verde en el mismo SHA (reusar artifacts o re-build determinista).

### 4.4 Toolchain fija en CI

| Item | Política objetivo |
|---|---|
| Node | LTS fijada en `.nvmrc` + `actions/setup-node` con cache pnpm |
| pnpm | Versión fijada (`packageManager` en `package.json` o `pnpm/action-setup`) |
| OS runner | `ubuntu-latest` v1; matrix OS no requerida |
| Prisma engines | Generar en CI; no commitear binarios de engine si el scaffold lo evita |

---

## 5. Artefactos, caches y environments

### 5.1 Caches

| Cache | Key sugerida | Qué acelera |
|---|---|---|
| pnpm store | `pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}` | `pnpm install` |
| Next.js | `.next/cache` por hash de lock + sources web | `next build` |
| Turbo (si se adopta) | cache remoto o local action | tasks monorepo |
| BuildKit / Docker layers | GitHub Actions cache backend de Buildx | rebuild imágenes |

**Real hoy:** 0 caches. No hay lockfile que hashear.

### 5.2 Artefactos a publicar (objetivo)

| Artefacto | Retención sugerida | Cuándo |
|---|---|---|
| `web-standalone` o `.next` export usable | 7–14 días | Tras `build-web` en main |
| `api-dist` (`dist/` Nest) | 7–14 días | Tras `build-api` |
| Imágenes OCI `api` / `worker` | Registry (GHCR u otro) | Push en `main` y tags `v*` |
| Reportes cobertura / JUnit | 7 días | Si se habilita coverage |
| SBOM / `npm audit` report | 30 días | Opcional seguridad |

Regla: **no** subir `.env`, dumps de DB, ni secretos como artifact.

### 5.3 Environments de GitHub (objetivo vs real)

| Environment | Estado real | Protección objetivo | Secretos típicos |
|---|---|---|---|
| *(ninguno)* | **Real** — 0 environments | — | — |
| `staging` | **Objetivo** | Opcional review; wait timer corto | `DATABASE_URL`, URLs deploy, tokens PaaS, Meta/Twilio **test**, LLM staging |
| `production` | **Objetivo** | **Required reviewers** (Medina); sin self-approve en v1 | Secretos **prod** separados; sin reutilizar staging |

Variables no secretas (`APP_ENV`, `PUBLIC_API_URL`, feature flags públicos) pueden vivir en *Environment variables*; claves en *Secrets*.

Alineación de aislamiento: [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §5 y setup infra §3.2 (una `DATABASE_URL` por entorno; no mezclar vectores ni tokens de canal).

### 5.4 Registry e identidades

| Destino | Uso | Estado |
|---|---|---|
| GHCR (`ghcr.io/PMedinaGarcia/...`) | Imágenes api/worker | **Objetivo** / **Decisión abierta** |
| Vercel | Panel Next.js | **Decisión abierta** ([../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) §1.3) |
| ECS / Cloud Run / Fly / Railway | API + worker | **Decisión abierta** |

OIDC (`permissions: id-token: write`) preferible a access keys de larga vida cuando el vendor lo permita.

---

## 6. Status checks que deben ser required

### 6.1 Estado real

`main` **sin** branch protection ni rulesets → hoy se puede mergear cualquier PR sin checks.

### 6.2 Checks required (objetivo, post-scaffold)

Nombre exacto = nombre del **job** (o check suite) que aparece en GitHub; ajustar al YAML final.

| Check | Required en PR → `main` | Motivo |
|---|---|---|
| `lint` (o `lint (api)`, `lint (web)`, `lint (shared)` si matrix expone cells) | Sí | Estilo / errores estáticos |
| `typecheck` (matrix) | Sí | TS estricto compartido con DTOs |
| `test` (api + shared; web cuando exista) | Sí | Regresiones de dominio |
| `build-api` | Sí | API desplegable |
| `build-web` | Sí | Panel desplegable |
| `prisma-validate` | Sí | Schema coherente |
| `migrate-dry-run` | Sí (cuando haya migraciones) | Evitar main roto en DB |
| `docker` | Sí una vez existan Dockerfiles | Paridad de imagen |

### 6.3 Política de protección de `main` (objetivo)

| Setting | Valor objetivo |
|---|---|
| Require a pull request before merging | Sí |
| Require status checks to pass | Sí — lista §6.2 |
| Require branches to be up to date | Sí (cuando la cola de CI lo permita) |
| Require review | ≥ 1 (CODEOWNERS si aplica) |
| Restrict who can push | Sin force-push a `main` |
| Require conversation resolution | Recomendado |
| Allow bypass | Solo admins en emergencia documentada |

Rulesets modernos de GitHub pueden sustituir la UI clásica de branch protection; el contrato funcional es el mismo.

### 6.4 Checks que NO deben ser required en v1

| Check | Por qué no required aún |
|---|---|
| Deploy staging/prod | No son gates de merge |
| E2E contra Meta/Twilio reales | Flaky / secretos / cuota |
| Audit de vulnerabilidades bloqueante estricto | Empezar como warn; endurecer después |
| Jobs docs-only | Evitar falsos rojos en PRs de documentación |

---

## 7. Deploy staging / producción — objetivo vs real

### 7.1 Real

| Ítem | Estado |
|---|---|
| Workflows de deploy | **No existen** |
| Environments GitHub | **No existen** |
| URLs staging/prod | **Pendiente (cuenta/cloud)** |
| `vercel.json` / IaC | **Pendiente** |
| Secretos de CI para deploy | **Pendiente** |

No hay “deploy real” que documentar: cero runs, cero environments.

### 7.2 Objetivo — staging

| Paso | Detalle |
|---|---|
| Trigger | Push a `main` (CI verde) y/o `workflow_dispatch` |
| Environment | `staging` |
| Migraciones | `prisma migrate deploy` contra DB staging |
| Apps | API + worker + panel (PaaS o contenedores según vendor) |
| Smoke | `GET /health` (y `/ready` si existe); panel `/login` 200; opcional login UAT |
| Canales | Meta/Twilio **test** únicamente |
| Banner | `NEXT_PUBLIC_APP_ENV=staging` |

Criterios de staging operable: [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) §11.2.

### 7.3 Objetivo — production

| Paso | Detalle |
|---|---|
| Trigger | Tag `v*` **o** `workflow_dispatch` con aprobación |
| Environment | `production` + **required reviewers** |
| Migraciones | `migrate deploy` solo tras backup/retention OK; nunca desde PR |
| Rollback | Redeploy imagen/release anterior (runbook Medina) |
| Smoke | Health + checklist parcial; **no** declarar go-live solo por CI verde |
| Canales | Credenciales **prod**; no reutilizar staging |

Go-live de producto sigue siendo humano: [../producto/02-fases-golive.md](../producto/02-fases-golive.md) §5 (G1–G11). Infra/CI verdes ≠ UAT firmado ([../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) §6.4).

### 7.4 Diagrama objetivo vs real

```
REAL (2026-07-27)
  git push ──► remoto (README) ──► (sin Actions) ──► (sin deploy)

OBJETIVO
  PR ──► ci.yml (required checks) ──► merge main
  main ──► ci.yml ──► deploy-staging.yml ──► smoke UAT
  tag v* ──► deploy-production.yml (approval) ──► smoke ──► checklist go-live humano
```

---

## 8. Troubleshooting de CI

### 8.1 Problemas esperables (cuando existan workflows)

| Síntoma | Causa probable | Acción |
|---|---|---|
| “No checks reported” en PR | Workflow no matchea `pull_request` / paths filter excluyó todo | Revisar `on:` y paths; forzar `workflow_dispatch` |
| Matrix roja solo en `shared` | Export Zod roto; api/web aún no recompilados | Fallar early; no mergear |
| `pnpm install` lento o flaky | Cache miss / lockfile desactualizado | Commit del lockfile; verificar `packageManager` |
| `prisma migrate` falla en CI | Imagen sin extensión `vector` | Usar `pgvector/pgvector`; `CREATE EXTENSION` en init |
| `next build` OOM | Runner pequeño / memoria | `NODE_OPTIONS=--max-old-space-size=4096` o build más delgado |
| Docker push 403 | Falta `packages: write` o login GHCR | Permisos del job + `GITHUB_TOKEN` / OIDC |
| Deploy staging OK, panel CORS fail | `CORS_ORIGINS` no incluye URL staging | Alinear secretos/env ([../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) §8) |
| Job cancelled | Concurrency group | Esperado en PR supersedidos; no en prod |
| Secrets vacíos | Environment no seleccionado / nombre typo | Verificar `environment:` y secretos del env, no solo repo |

### 8.2 Diagnóstico local vs CI

1. Reproducir con la **misma** versión Node/pnpm que CI.
2. `pnpm install --frozen-lockfile` (equivale a CI estricto).
3. Para DB: `docker compose up` con pgvector y correr migrate como el job.
4. Evitar “pasa en mi máquina” con `.env` que CI no tiene: tests deben usar mocks o service containers.

### 8.3 Operación GitHub

```bash
# Listar runs fallidos recientes
gh run list --repo PMedinaGarcia/tres-cielos-sys --limit 20

# Ver job concreto
gh run view <run-id> --repo PMedinaGarcia/tres-cielos-sys --log-failed

# Re-run
gh run rerun <run-id> --repo PMedinaGarcia/tres-cielos-sys --failed
```

**Hoy:** `gh run list` devolverá vacío (`total_count: 0`).

### 8.4 Incidentes de seguridad en CI

- Si un secreto se imprime en logs: rotar de inmediato; purgar logs si el plan lo permite.
- No reutilizar `GITHUB_TOKEN` con permisos amplios en jobs de PR de forks (repo público: cuidar `pull_request_target`).
- Preferir OIDC; evitar keys AWS/GCP de larga duración en secrets de PR.

---

## 9. Criterios de éxito de CI/CD

Un pipeline se considera **exitoso como sistema** cuando se cumplen los ítems aplicables. Distinguir *CI listo* de *CD listo* de *go-live producto*.

### 9.1 CI listo (calidad)

- [ ] Existen workflows bajo `.github/workflows/` en el remoto
- [ ] Todo PR a `main` dispara lint + typecheck + test + build api/web
- [ ] `prisma validate` + migrate sobre Postgres+pgvector en CI
- [ ] Lockfile committed; install reproducible con `--frozen-lockfile`
- [ ] Branch protection / ruleset exige los checks §6.2
- [ ] Cero secretos en el repo; secret scanning / gitleaks opcional en CI
- [ ] Documentación de scripts en `package.json` alineada a este doc

### 9.2 CD staging listo

- [ ] Environment `staging` creado con secretos separados
- [ ] Deploy automático o manual documentado desde `main`
- [ ] `migrate deploy` + smoke `/health` y `/login` post-deploy
- [ ] Canales de prueba (no prod) configurados
- [ ] Rollback de imagen/release ensayado al menos una vez

### 9.3 CD production listo

- [ ] Environment `production` con **required reviewers**
- [ ] Deploy solo por tag SemVer o dispatch aprobado
- [ ] Backup/restore procedure conocido antes de migrar
- [ ] Smoke post-deploy + runbook de rollback
- [ ] Observabilidad mínima (logs/alertas) según [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §6

### 9.4 Definición binaria

| Nivel | Definición |
|---|---|
| **CI OK** | Ningún merge a `main` sin gates de calidad verdes |
| **CD staging OK** | Cada merge elegible produce (o puede producir) staging operable para UAT |
| **CD prod OK** | Release reproducible con aprobación humana y rollback |
| **Go-live OK** | CD prod OK **más** criterios G1–G11 de producto — fuera del alcance exclusivo de Actions |

---

## 10. Gaps

| ID | Gap | Impacto | Mitigación |
|---|---|---|---|
| G-A1 | Remoto sin `.github/workflows/` ni runs | No hay CI real | Scaffold + `ci.yml` mínimo |
| G-A2 | Workspace docs ≠ remoto (solo README remoto) | Riesgo de documentar un repo vacío como si tuviera app | Sincronizar docs/código al remoto en fase scaffold |
| G-A3 | Sin branch protection / rulesets | Merge sin gates | Activar al primer workflow verde |
| G-A4 | Sin GitHub Environments | No hay approvals ni secretos por entorno | Crear `staging` / `production` |
| G-A5 | Sin monorepo / lockfile / scripts | No hay comandos que CI pueda invocar | Completar [../setup/01-frontend-setup.md](../setup/01-frontend-setup.md) y [../setup/02-backend-setup.md](../setup/02-backend-setup.md) |
| G-A6 | Sin Dockerfiles / Compose | Job `docker` y migrate service no anclados | [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) §5 |
| G-A7 | Vendor PaaS / registry no elegido | Deploy YAML no puede ser final | Kick-off infra; parametrizar con secrets |
| G-A8 | Versión Node/pnpm/Postgres no fijada | Drift local vs CI | `.nvmrc`, `packageManager`, imagen pgvector pinada |
| G-A9 | Cola BullMQ vs SQS no decidida | E2E CI puede o no necesitar Redis | Decidir antes de `test-e2e` |
| G-A10 | SHA pinning de actions no exigido | Supply-chain más débil | Pins por SHA + Dependabot |
| G-A11 | `docs/README.md` aún no indexa `docs/github/` | Descubribilidad | Actualizar índice cuando la suite GitHub esté completa |
| G-A12 | Paths filters / CODEOWNERS inexistentes | Ruido o falta de ownership | Añadir con el primer PR de app |
| G-A13 | Sin smoke automatizado post-deploy | CD “verde” sin prueba HTTP | Job smoke con URL de environment |
| G-A14 | Accesos Meta/Twilio/cliente | Staging de canales bloqueado aunque CI exista | [../producto/02-fases-golive.md](../producto/02-fases-golive.md) §6 |

---

## 11. Referencias cruzadas

| Doc | Relación |
|---|---|
| [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) §6, §11 | Pipeline bosquejado, checklists entorno |
| [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) | Componentes, secretos, entornos |
| [../frontend/01-estructura.md](../frontend/01-estructura.md) | Monorepo `apps/*` + `packages/shared` |
| [../setup/01-frontend-setup.md](../setup/01-frontend-setup.md) | Scripts `lint` / `typecheck` / `build` panel |
| [../setup/02-backend-setup.md](../setup/02-backend-setup.md) | Scripts API, Prisma, e2e smoke futuro |
| [../producto/02-fases-golive.md](../producto/02-fases-golive.md) | UAT / go-live ≠ CI verde |
| [../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) | Health público; webhooks ≠ JWT |

---

## 12. Criterio de cierre de este entregable

Quedan documentados, de forma operable para implementación:

1. Estado **real** de Actions en `PMedinaGarcia/tres-cielos-sys` (0 workflows, 0 runs, Actions enabled, sin protection/environments)
2. Pipelines **objetivo** (lint, typecheck, test, build FE/BE, prisma/migrate dry-run, docker)
3. Triggers (PR, push `main`, tags `v*`, manual)
4. Matrix/jobs alineados al monorepo objetivo
5. Artefactos, caches y environments de deploy
6. Status checks a marcar required
7. Deploy staging/prod (**objetivo** vs **real** vacío)
8. Troubleshooting de CI
9. Criterios de éxito CI / CD staging / CD prod
10. Registro de gaps G-A1–G-A14

**Implementado en GitHub Actions: 0 %.** Este documento es el contrato de CI/CD hasta el primer workflow versionado en el remoto.
