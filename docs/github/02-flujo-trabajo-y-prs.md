# Flujo de trabajo GitHub y Pull Requests — Tres Cielos

Documento de **proceso colaborativo** para el repositorio [`PMedinaGarcia/tres-cielos-sys`](https://github.com/PMedinaGarcia/tres-cielos-sys): ramas, commits, PRs, revisión, protección de ramas, hotfixes y criterios de éxito del flujo.

Complementa (no sustituye):

| Área | Doc |
|---|---|
| Setup y CI objetivo | [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) §6 |
| Criterios de calidad / CI | [../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md) §8 |
| Monorepo FE/BE | [../frontend/01-estructura.md](../frontend/01-estructura.md) §3 |
| Entornos | [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §5 |
| Fases go-live | [../producto/02-fases-golive.md](../producto/02-fases-golive.md) |

**Inspección remota:** `gh` API / CLI, 2026-07-27. **Sin commits ni cambios en el remoto** desde este entregable documental.

---

## Leyenda de estado

| Etiqueta | Significado |
|---|---|
| **Implementado (remoto)** | Existe hoy en GitHub (`PMedinaGarcia/tres-cielos-sys`) |
| **Implementado (docs)** | Definido en documentación local del workspace; listo para adoptar |
| **Pendiente (remoto)** | No configurado en GitHub; hay que crearlo |
| **Objetivo (recomendado)** | Diseño propuesto para el equipo Medina / Tres Cielos |

---

## 0. Snapshot del repositorio remoto (estado real)

| Campo | Valor | Estado |
|---|---|---|
| URL | https://github.com/PMedinaGarcia/tres-cielos-sys | **Implementado (remoto)** |
| Visibilidad | Pública | **Implementado (remoto)** |
| Rama por defecto | `main` | **Implementado (remoto)** |
| Otras ramas | Ninguna (solo `main`) | **Implementado (remoto)** |
| Contenido en `main` | Solo `README.md` (título `# tres-cielos-sys`) | **Implementado (remoto)** — vacío de producto |
| Commits | 1 (`Initial commit`, autor `PMedinaGarcia`) | **Implementado (remoto)** |
| Pull requests | 0 (abiertos o cerrados) | **Implementado (remoto)** |
| Issues abiertos | 0 | **Implementado (remoto)** |
| Issues habilitados | Sí (`isBlankIssuesEnabled: true`) | **Implementado (remoto)** |
| Projects habilitados (flag repo) | Sí (`has_projects: true`) | **Implementado (remoto)** |
| Projects V2 listables | No verificable con el token actual (`read:project` ausente) | **Gap de observación** |
| Wiki / Discussions | Wiki on; Discussions off | **Implementado (remoto)** |
| Colaboradores | Solo `PMedinaGarcia` | **Implementado (remoto)** |
| Teams | N/A (repo de usuario, no org) | **Implementado (remoto)** |
| Releases / Environments | 0 | **Implementado (remoto)** |
| GitHub Actions workflows | 0 | **Pendiente (remoto)** |
| Carpeta `.github/` | No existe | **Pendiente (remoto)** |
| CODEOWNERS | No existe | **Pendiente (remoto)** |
| Plantillas PR / issue | Arrays vacíos | **Pendiente (remoto)** |
| Branch protection `main` | **No protegida** (HTTP 404) | **Pendiente (remoto)** |
| Rulesets | `[]` | **Pendiente (remoto)** |
| Labels | Solo defaults de GitHub (bug, documentation, enhancement, …) | **Implementado (remoto)** — genéricos |
| Merge methods | merge commit + squash + rebase **todos** permitidos | **Implementado (remoto)** |
| Auto-merge | Off | **Implementado (remoto)** |
| Delete branch on merge | Off | **Implementado (remoto)** |
| Allow update branch | Off | **Implementado (remoto)** |
| Topics | Ninguno | **Pendiente (remoto)** |

**Workspace local** (`c:\Users\Patricio\Desktop\TRES-CIELOS-SYS`): documentación profunda en `docs/` + PDF comercial. Ese material **aún no está** en el remoto inspeccionado (el remoto solo tiene README vacío). El flujo de PRs de este documento aplica tanto al push inicial de docs como al scaffold FE/BE/infra.

---

## 1. Estrategia de ramas

### 1.1 Actual (remoto)

| Aspecto | Realidad |
|---|---|
| Modelo | **Trunk-only implícito:** existe únicamente `main` |
| Protección | Ninguna |
| Integración | Push directo a `main` posible (admin sin checks) |
| `develop` / `release/*` / `hotfix/*` | No existen |

**Estado:** **Implementado (remoto)** como “solo `main`”; **no** hay estrategia formal documentada en el remoto.

### 1.2 Recomendada (objetivo) — `main` + `develop` + `feature/*`

Para un monorepo con API NestJS, panel Next.js, Prisma/pgvector y deploy a `dev` / `staging` / `prod` ([infra §5](../infrastructure/01-stack-y-entornos.md)), se recomienda **GitHub Flow enriquecido** con rama de integración:

```
feature/* ──PR──► develop ──PR──► main
                      │              │
                      ▼              ▼
                   staging         prod
                   (auto/manual)   (manual + aprobación)

hotfix/* ──PR──► main ──cherry-pick / merge back──► develop
```

| Rama | Rol | Deploy típico | Quién mergea |
|---|---|---|---|
| `main` | Producción / fuente de verdad estable | **prod** (manual) | PR desde `develop` o `hotfix/*` con review + CI |
| `develop` | Integración continua del sprint / etapa | **staging** (auto o manual) | PR desde `feature/*`, `fix/*`, `chore/*` |
| `feature/<área>-<slug>` | Trabajo de una historia o ticket | Solo local / preview | Autor abre PR → `develop` |
| `fix/<slug>` | Corrección no urgente | Igual que feature | PR → `develop` |
| `hotfix/<slug>` | Incidente en prod (canales, auth, datos) | Bypass de `develop` hacia `main` | PR → `main` + back-merge a `develop` |
| `release/<x.y>` *(opcional v1)* | Congelar UAT / go-live Jardín 1 | staging → prod | Solo si el corte necesita freeze; si no, usar tag en `main` |

**Estado:** **Objetivo (recomendado)**. Crear `develop` desde `main` en el primer PR de gobernanza.

### 1.3 Convención de nombres de ramas

```
feature/fe-bandeja-prioridad
feature/be-asignacion-round-robin
feature/db-prisma-modelo-inicial
feature/infra-compose-postgres
fix/be-webhook-meta-firma
docs/github-flujo-prs
chore/ci-lint-typecheck
hotfix/be-handoff-estado-bot
```

Prefijos de área alineados al monorepo objetivo ([frontend/01 §3](../frontend/01-estructura.md)):

| Prefijo de área | Alcance |
|---|---|
| `fe-` | `apps/web` (panel) |
| `be-` | `apps/api` + worker |
| `db-` | Prisma schema / migraciones / seeds |
| `shared-` | `packages/shared` (Zod, enums) |
| `infra-` | Compose, Actions, IaC, secretos de entorno |
| `docs-` | Solo documentación |

Slug: `kebab-case`, sin espacios, sin datos sensibles.

### 1.4 Alternativa mínima (si el equipo es 1–2 personas al inicio)

Hasta tener CI y segundo colaborador:

1. Trabajar en `feature/*` → PR a `main`.
2. Activar branch protection + 1 aprobación en cuanto haya segundo reviewer o CI.
3. Introducir `develop` al abrir Etapa 2–4 (código API/panel), cuando staging exista.

**Estado:** **Objetivo (recomendado)** como fase transitoria; el modelo §1.2 es el destino.

---

## 2. Convención de commits y PRs

### 2.1 Commits — Conventional Commits (objetivo)

**Estado remoto:** el único commit es `Initial commit` (sin convención). **Objetivo (recomendado):**

```
<tipo>(<área>): <descripción en imperativo, ≤72 chars>

[cuerpo opcional: por qué / impacto]

[footer: Refs #123 / BREAKING CHANGE: ...]
```

| Tipo | Uso |
|---|---|
| `feat` | Nueva capacidad alineada a docs de producto |
| `fix` | Corrección de defecto |
| `docs` | Solo documentación |
| `chore` | Tooling, deps, CI sin cambio de producto |
| `refactor` | Sin cambio de comportamiento observable |
| `test` | Tests |
| `perf` | Rendimiento |
| `ci` | Pipelines GitHub Actions |
| `build` | Build / monorepo / Docker |

Áreas sugeridas: `web`, `api`, `shared`, `db`, `infra`, `docs`, `rag`, `crm`, `auth`.

Ejemplos:

```
feat(api): enrutar handoff cuando rerank < 0.85
fix(web): ocultar /asignacion para rol asesor (F1)
docs(producto): alinear checklist UAT G10
chore(ci): añadir lint y typecheck en PR
```

Reglas:

- Un commit = una intención; preferir squash merge en PRs feature.
- **Prohibido** secretos, `.env`, tokens Meta/Twilio/Cohere en el diff ([infra §4](../infrastructure/01-stack-y-entornos.md)).
- Mensajes en **español o inglés**; elegir uno por equipo y no mezclar en el mismo PR (recomendación: **español** alineado a docs de producto).

### 2.2 Títulos de Pull Request

```
<tipo>(<área>): <resumen>
```

Igual que el commit canónico del squash. En el cuerpo: enlace a issue, checklist, riesgo, plan de prueba.

### 2.3 Labels (actual vs objetivo)

**Implementado (remoto)** — defaults:

`bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`

**Objetivo (recomendado)** — añadir (sin borrar defaults si se usan):

| Label | Uso |
|---|---|
| `area:frontend` | Panel Next.js |
| `area:backend` | NestJS / orquestador / webhooks |
| `area:database` | Prisma / migraciones |
| `area:infra` | Compose, Actions, secretos, red |
| `area:docs` | Documentación |
| `area:rag` | Ingesta, hybrid search, rerank |
| `priority:p0` | Bloquea go-live / prod roto |
| `priority:p1` | Sprint / etapa actual |
| `priority:p2` | Backlog |
| `type:feat` / `type:fix` / `type:chore` | Tipo de cambio |
| `needs-product` | Requiere decisión vs `docs/producto/` |
| `blocked` | Esperando acceso Meta/Twilio/cuenta |
| `uat` | Caso o evidencia UAT |
| `security` | Auth, webhooks, secretos, RBAC |

### 2.4 Merge method recomendado

| Método | Remoto hoy | Recomendación |
|---|---|---|
| Squash | Permitido | **Preferido** para `feature/*` → `develop` / `main` |
| Merge commit | Permitido | Solo merges `develop` → `main` o back-merge hotfix |
| Rebase | Permitido | Evitar en PRs compartidos; opcional local |

**Objetivo:** desactivar merge commit ruidoso *o* documentar “squash por defecto”; activar **delete branch on merge**.

---

## 3. Plantillas de issue y PR

### 3.1 Estado real

| Artefacto | Estado |
|---|---|
| `.github/PULL_REQUEST_TEMPLATE.md` | **Pendiente (remoto)** |
| `.github/ISSUE_TEMPLATE/*` | **Pendiente (remoto)** |
| `pullRequestTemplates` / `issueTemplates` vía API | Arrays vacíos |
| Issues en blanco | Permitidos (`isBlankIssuesEnabled: true`) |

### 3.2 Plantilla de PR — objetivo

Crear `.github/PULL_REQUEST_TEMPLATE.md` (o `pull_request_template.md`):

```markdown
## Resumen
<!-- Qué cambia y por qué (1–3 bullets). Enlazar docs/producto o issue. -->

## Tipo de cambio
- [ ] feat
- [ ] fix
- [ ] docs
- [ ] chore / ci / refactor / test

## Área
- [ ] frontend (`apps/web`)
- [ ] backend (`apps/api` / worker)
- [ ] shared / DB (Prisma)
- [ ] infra / CI
- [ ] solo docs

## Criterios de producto tocados
<!-- IDs: F1–F7, C1–C7, G1–G11, DoD-*, D-* según docs/setup/04 -->
-

## Plan de prueba
- [ ] Lint / typecheck locales
- [ ] Tests unit/contract relevantes
- [ ] Smoke manual (pasos + rol: asesor/coord/admin)
- [ ] Sin secretos en el diff

## Riesgos / rollback
-

## Screenshots / evidencias
<!-- UI o logs de telemetría si aplica -->
```

**Estado:** **Objetivo (recomendado)** — contenido **Implementado (docs)** en este archivo; archivo en repo **Pendiente (remoto)**.

### 3.3 Plantillas de issue — objetivo

Directorio `.github/ISSUE_TEMPLATE/`:

1. **`bug.yml` / `bug.md`** — repro, entorno (`dev`/`staging`/`prod`), rol, esperado vs actual, IDs F/C si aplica.
2. **`feature.yml`** — problema de usuario, superficie (`/bandeja`, etc.), fuera de anti-alcance ([setup/04 §12](../setup/04-criterios-de-exito.md)).
3. **`docs.yml`** — gap documental vs código.
4. **`config.yml`** — desactivar blank issues *o* dejarlos solo para misc; preferir templates.

Ejemplo mínimo bug:

```markdown
## Descripción
## Pasos para reproducir
## Esperado / Actual
## Entorno (dev | staging | prod)
## Rol (asesor | coordinador | admin)
## Evidencia (IDs expediente / EventoOperativo si hay)
## ¿Bloquea go-live? (P0 sí/no)
```

**Estado:** **Objetivo (recomendado)**.

---

## 4. Code review: quién aprueba y checks requeridos

### 4.1 Estado real

| Aspecto | Realidad |
|---|---|
| CODEOWNERS | **Pendiente (remoto)** |
| Required reviewers | No (sin branch protection) |
| Status checks | Ninguno (0 workflows) |
| Colaboradores reviewables | Solo owner `PMedinaGarcia` |

Hoy **no hay** proceso de review enforceable. Cualquier push a `main` (con permisos de escritura) entra sin gate.

### 4.2 Quién aprueba — objetivo

Repo de **usuario** (no organización con teams). Hasta migrar a org Medina:

| Alcance del diff | Reviewer requerido (objetivo) |
|---|---|
| `docs/**` | 1 reviewer técnico Medina (owner o colaborador) |
| `apps/web/**` | Owner FE o full-stack Medina |
| `apps/api/**`, worker, orquestador/RAG | Owner BE Medina |
| `prisma/**`, migraciones | BE + revisión explícita de índices/pgvector |
| `.github/workflows/**`, Compose, IaC | Owner infra / full-stack |
| Auth, webhooks, secretos, RBAC | **Obligatorio** reviewer senior Medina (`security`) |
| Change que toque anti-alcance o C3/C5/F1 | Review + referencia a doc de producto |

**CODEOWNERS objetivo** (pendiente de crear):

```
# .github/CODEOWNERS
*                      @PMedinaGarcia
/apps/web/             @PMedinaGarcia
/apps/api/             @PMedinaGarcia
/packages/shared/      @PMedinaGarcia
/docs/                 @PMedinaGarcia
/.github/              @PMedinaGarcia
```

Cuando existan más handles GitHub del equipo, sustituir por paths granulares. Con un solo owner, CODEOWNERS documenta responsabilidad pero **no sustituye** second pair of eyes externo (cliente UAT ≠ code review).

### 4.3 Checks requeridos en PR — objetivo

Alineado a [setup/03 §6](../setup/03-infraestructura-setup.md) y [setup/04 §8](../setup/04-criterios-de-exito.md):

| Check | Obligatorio para merge a `develop`/`main` | Estado |
|---|---|---|
| Lint (ESLint/Prettier o acordado) | Sí | **Pendiente (remoto)** |
| Typecheck (`tsc` / Nest build) | Sí | **Pendiente (remoto)** |
| Unit + contract (guards, Zod↔DTO, anti-alucinación) | Sí (cuando exista suite) | **Pendiente (remoto)** |
| Build `api` + `web` | Sí | **Pendiente (remoto)** |
| `prisma validate` / migrate dry-run | Sí si toca DB | **Pendiente (remoto)** |
| Scan secretos básico | Recomendado | **Pendiente (remoto)** |
| E2E completo | No en cada PR; sí pre-UAT staging | **Pendiente** |

**Regla de producto:** badge CI verde obligatorio para merge a `main` cuando exista código ([setup/04 §8.2](../setup/04-criterios-de-exito.md)).

### 4.4 Checklist del reviewer

1. ¿El cambio está en alcance (no anti-criterios §12)?
2. ¿RBAC/ownership en **API**, no solo UI (F1)?
3. ¿Precios solo vía catálogo / tools (C3)?
4. ¿Handoff seguro si falta conocimiento (C5)?
5. ¿Migraciones reversibles o plan de deploy documentado?
6. ¿Secretos fuera del repo?
7. ¿Tests o evidencia manual acorde al riesgo?

---

## 5. Branch protection — estado real + recomendado

### 5.1 Real (`main`)

```
GET /repos/PMedinaGarcia/tres-cielos-sys/branches/main/protection
→ 404 Branch not protected

GET /repos/.../rulesets → []
```

**Estado:** **Pendiente (remoto)** — `main` sin protección ni rulesets.

### 5.2 Configuración recomendada (`main`)

| Setting | Valor objetivo |
|---|---|
| Require a pull request before merging | **On** |
| Required approvals | **≥ 1** (subir a 2 cuando haya ≥3 colaboradores) |
| Dismiss stale reviews | **On** |
| Require review from CODEOWNERS | **On** cuando exista archivo |
| Require status checks to pass | **On** — checks §4.3 |
| Require branches to be up to date | **On** (cuando CI sea estable) |
| Require conversation resolution | **On** |
| Do not allow bypassing (admins) | **On** en cuanto el equipo >1; opcional off solo en bootstrap |
| Restrict who can push | Solo vía PR |
| Allow force pushes | **Off** |
| Allow deletions | **Off** |
| Require linear history | Opcional (compatible con squash) |

### 5.3 Protección de `develop` (cuando exista)

Igual que `main`, con posible excepción: permitir merge con 1 aprobación y CI verde sin “up to date” estricto al inicio del sprint, endurecer antes de Etapa 7 (UAT).

### 5.4 Rulesets vs classic protection

**Objetivo:** preferir **Repository rulesets** (API ya consulta `rulesets`; hoy vacío) para `main` + `develop`, con bypass limitado a emergencias documentadas.

---

## 6. Flujo day-to-day por área (FE / BE / infra)

### 6.1 Secuencia común (todas las áreas)

```
1. Issue (template) o tarea de etapa (producto/02)
2. git fetch && git checkout develop && git pull
3. git checkout -b feature/<área>-<slug>
4. Implementar alineado a docs/ (código gana al scaffold; docs se actualizan en el mismo PR si divergen)
5. Commits Conventional Commits
6. Push + gh pr create → base develop (o main en fase transitoria)
7. CI verde + review
8. Squash merge; borrar rama
9. Verificar staging; si es release: PR develop → main + tag
```

### 6.2 Frontend (`apps/web`)

| Paso | Detalle |
|---|---|
| Contrato | Superficies y routing en `docs/frontend/`; setup en [setup/01](../setup/01-frontend-setup.md) |
| Branch | `feature/fe-...` |
| PR debe incluir | Gates de rol (espejo RBAC), empty/403 states, sin secretos de backend en `NEXT_PUBLIC_*` indebidos |
| Prueba mínima | Login por rol + superficie tocada; deep link no autorizado |
| CI | lint + typecheck + build web |
| Deploy | Preview (si PaaS) → staging con `NEXT_PUBLIC_API_URL` de staging |

### 6.3 Backend (`apps/api` + worker)

| Paso | Detalle |
|---|---|
| Contrato | Dominios, orquestador, DTOs, guards en `docs/backend/` |
| Branch | `feature/be-...` o `feature/db-...` si es solo Prisma |
| PR debe incluir | Tests de F1/C3/C5 si toca esos caminos; migraciones revisadas |
| Prueba mínima | Unit dominio + contract Zod; smoke webhook firma en staging |
| CI | lint + typecheck + unit/contract + prisma validate + build api |
| Cuidado | No apuntar webhooks **prod** a URLs de staging ([setup/03 §6.3](../setup/03-infraestructura-setup.md)) |

### 6.4 Shared / contratos FE↔BE

Cambios en `packages/shared` (enums, Zod):

1. PR único que actualice shared + consumidores api/web, **o** PR ordenado shared → api/web el mismo día.
2. Label `area:backend` + `area:frontend`.
3. Contract tests obligatorios cuando existan.

### 6.5 Infra / CI / secretos

| Paso | Detalle |
|---|---|
| Branch | `feature/infra-...` o `chore/ci-...` |
| PR | Workflows, Compose, docs de runbook; **nunca** valores de secretos |
| Review | Obligatorio owner |
| Deploy prod | Manual con aprobación humana ([setup/03 §6.2](../setup/03-infraestructura-setup.md)) |
| Environments GitHub | Crear `staging` / `prod` con required reviewers en prod (**Pendiente (remoto)** — 0 environments hoy) |

### 6.6 Solo documentación

| Paso | Detalle |
|---|---|
| Branch | `docs/...` |
| Base | `develop` o `main` (aceptable a `main` si aún no hay código) |
| Review | Ligero pero requerido tras activar protection |
| Nota | El workspace local ya tiene `docs/` ricos; el primer sync al remoto debería ser PR `docs:` con índice actualizado |

### 6.7 Alineación a fases de producto

| Etapa (producto/02) | Enfoque de PRs |
|---|---|
| 1 Diseño | Mayoría `docs/` |
| 2–6 Meta → notificaciones | `be`/`fe`/`db` por dominio; CI debe existir |
| 7 UAT | Freeze relativo; solo `fix`/`hotfix` + evidencias |
| 8 Capacitación | Docs de guía usuario (si versionadas) |
| 9 WhatsApp | Feature flag / canal; no redefinir embudo |

---

## 7. Hotfix y release branches

### 7.1 Hotfix (incidente en producción)

**Cuándo:** prod roto (webhooks, auth panel, montos inventados C3, fuga RBAC F1, frescura rota C4).

```
1. Branch desde main: hotfix/<slug>
2. Fix mínimo + test de regresión
3. PR → main (CI + 1 aprobación; bypass admin solo si outage y se documenta en issue)
4. Tag vX.Y.Z y deploy prod
5. Merge/cherry-pick inmediato a develop (evitar divergencia)
6. Postmortem breve en issue `type:fix` + label priority:p0
```

**Estado:** **Objetivo (recomendado)** — no hay historial de hotfixes (repo vacío de código).

### 7.2 Release branches

**v1 recomendación:** para go-live Jardín 1, preferir:

- `develop` estable → PR a `main`
- Tag semver `v0.1.0` / `v1.0.0-golive-j1`
- Checklist humano G1–G11 ([producto/02](../producto/02-fases-golive.md)) — **no** sustituible por CI verde

Usar `release/x.y` solo si UAT exige freeze >3–5 días con features entrando aún a `develop`.

### 7.3 Versionado

| Elemento | Objetivo |
|---|---|
| Tags | SemVer en `main` |
| Changelog | Opcional `CHANGELOG.md` o releases de GitHub |
| Releases GitHub | **Pendiente (remoto)** — usar al primer deploy staging/prod |

---

## 8. Criterios de éxito del flujo colaborativo

El flujo es **exitoso** cuando se cumplen (binario):

| ID | Criterio | Estado hoy |
|---|---|---|
| GW-1 | Todo cambio de código/docs llega a `main` vía PR (no push directo) | **No** — protection off |
| GW-2 | CI obligatorio (lint + typecheck + tests acordados) en verde antes de merge | **No** — 0 workflows |
| GW-3 | ≥1 aprobación humana en PRs a `main`/`develop` | **No** |
| GW-4 | CODEOWNERS o matriz de reviewers por área publicada | **No** |
| GW-5 | Issues/PRs con template y labels de área/prioridad | **Parcial** — labels default; sin templates |
| GW-6 | Ramas `feature/*` nombradas; squash + delete on merge | **No** — sin política |
| GW-7 | Secretos nunca en git; review checklist lo verifica | Política en docs; **no** enforce en remoto |
| GW-8 | `develop` → staging; `main` → prod con aprobación | Entornos GH **Pendiente**; modelo en docs infra |
| GW-9 | Hotfix dejan `main` y `develop` alineados | N/A aún |
| GW-10 | PRs enlazan IDs de producto (F/C/G/DoD) cuando tocan comportamiento | **Objetivo** — práctica de equipo |
| GW-11 | UAT/go-live sigue checklist humano aunque CI esté verde | **Implementado (docs)** en setup/04 y producto/02 |
| GW-12 | Onboarding: nuevo colaborador clona, lee este doc + setup 01–03, abre primer PR docs o chore | **Parcial** — docs locales sí; remoto vacío |

**Definition of Done del proceso GitHub (meta de ingeniería):** GW-1…GW-8 en verde antes de Etapa 2 con código en staging.

---

## 9. Gaps

### 9.1 Remoto vs workspace local

| Gap | Detalle | Impacto |
|---|---|---|
| G-GH-1 | Remoto solo tiene README; workspace local tiene `docs/` completo | Riesgo de divergencia; urge PR inicial de documentación |
| G-GH-2 | Sin `.github/` (workflows, templates, CODEOWNERS) | Sin gobernanza ni CI |
| G-GH-3 | `main` sin branch protection / rulesets | Push directo y force-push posibles según permisos |
| G-GH-4 | Un solo colaborador | Review real limitado; CODEOWNERS simbólico |
| G-GH-5 | Sin Projects verificables (token sin `read:project`) / sin issues de trabajo | No hay tablero de etapas 1–9 en GH confirmado |
| G-GH-6 | Labels solo defaults | No hay taxonomía área/prioridad/producto |
| G-GH-7 | Tres merge methods activos; delete-on-merge off | Historial ruidoso; ramas huérfanas |
| G-GH-8 | 0 Environments, 0 Actions, 0 Releases | No hay promote staging→prod en GitHub |
| G-GH-9 | Repo público con producto comercial en docs locales aún no subidos | Revisar sensibilidad antes del primer push masivo de docs |
| G-GH-10 | Sin `develop` ni convención de ramas publicada en el repo | Cada contribuidor puede inventar flujo |
| G-GH-11 | CI/CD descrito en setup/03 pero no implementado | Alineado a gap G-I4 de infra setup |
| G-GH-12 | Wiki habilitada | Riesgo de docs duplicados fuera de `docs/`; preferir desactivar wiki o redirigir al árbol `docs/` |

### 9.2 Decisiones abiertas

| Decisión | Opciones | Notas |
|---|---|---|
| ¿Org GitHub Medina vs user `PMedinaGarcia`? | Migrar a org con teams | Mejora CODEOWNERS y rulesets |
| ¿GitHub Projects vs Notion/Linear? | Projects V2 o herramienta externa | Token actual no listó projects |
| ¿Exigir `develop` desde día 1? | Sí / fase transitoria solo `main` | §1.4 |
| ¿Idioma de commits? | ES vs EN | Elegir uno |
| ¿Desactivar wiki y blank issues? | Recomendado sí / templates only | Reduce ruido |

### 9.3 Prioridad sugerida de cierre de gaps

1. PR inicial: volcar `docs/` + este archivo; README real.
2. Añadir `.github/` templates + labels custom.
3. Crear workflow CI mínimo (aunque sea `docs` + placeholder lint).
4. Activar ruleset/protection en `main` (PR obligatorio + 1 review).
5. Crear `develop` al primer scaffold de código.
6. Environments `staging`/`prod` + delete branch on merge + squash default.
7. CODEOWNERS actualizado cuando entren colaboradores.

---

## 10. Matriz resumen implementado vs pendiente

| Ítem | Implementado | Pendiente / Objetivo |
|---|---|---|
| Repo + `main` + Issues on | Remoto | — |
| Estrategia `main`/`develop`/`feature` | — | Objetivo §1.2 |
| Conventional Commits + títulos PR | — | Objetivo §2 |
| Labels de producto/área | Solo defaults | Objetivo §2.3 |
| Templates issue/PR | — | Objetivo §3 (texto en este doc) |
| CODEOWNERS + required review | — | Objetivo §4 |
| CI checks en PR | — | Objetivo §4.3 / setup/03 §6 |
| Branch protection / rulesets | — | Objetivo §5 |
| Flujo FE/BE/infra day-to-day | Docs (este archivo) | Práctica en remoto |
| Hotfix / release / tags | — | Objetivo §7 |
| Criterios GW-1…GW-12 | GW-11 en docs producto | Resto pendiente en remoto |
| Projects / Environments / Actions | Flags parciales | Sin uso real |

---

## 11. Referencias de inspección (`gh`)

Comandos útiles para re-validar este documento:

```bash
gh repo view PMedinaGarcia/tres-cielos-sys --json defaultBranchRef,deleteBranchOnMerge,mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed,issueTemplates,pullRequestTemplates,hasIssuesEnabled
gh api repos/PMedinaGarcia/tres-cielos-sys/branches/main/protection
gh api repos/PMedinaGarcia/tres-cielos-sys/rulesets
gh api repos/PMedinaGarcia/tres-cielos-sys/actions/workflows
gh label list --repo PMedinaGarcia/tres-cielos-sys
gh pr list --repo PMedinaGarcia/tres-cielos-sys --state all
```

Para Projects V2: `gh auth refresh -s read:project` y luego `gh project list --owner PMedinaGarcia`.

---

## 12. Criterio de cierre de este entregable

Quedan documentados, en español y con marca **implementado vs pendiente/objetivo**: estrategia de ramas (actual vs recomendada), convenciones de commits/PRs, plantillas propuestas, code review y checks, branch protection real + recomendada, flujos day-to-day FE/BE/infra, hotfix/release, criterios de éxito del flujo colaborativo (GW-*) y gaps priorizados — alineados a la documentación local de setup, producto e infraestructura, sin modificar el remoto.
