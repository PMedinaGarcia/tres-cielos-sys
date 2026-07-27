# GitHub — entornos, secretos y gobierno

Gobierno del repositorio **[`PMedinaGarcia/tres-cielos-sys`](https://github.com/PMedinaGarcia/tres-cielos-sys)** para Event Master System (Tres Cielos / Medina Systems): Environments de GitHub, inventario de secretos/variables (solo **nombres**), credenciales cloud/OIDC, protección de `main`, seguridad automatizada, releases, acceso y checklist de go-live.

**Fecha de inspección remota:** 2026-07-27 (vía `gh` API, autenticado como admin del repo).

**Alineación:** [../setup/01-frontend-setup.md](../setup/01-frontend-setup.md), [../setup/02-backend-setup.md](../setup/02-backend-setup.md), [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md), [../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md) (NF-S-*, INF-*, §8 CI, §10 go-live), [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md).

**Relacionados en esta carpeta:** [03-actions-ci-cd.md](03-actions-ci-cd.md) (pipelines), [02-flujo-trabajo-y-prs.md](02-flujo-trabajo-y-prs.md) (PRs / protección de ramas en detalle de proceso).

---

## Leyenda de estado

| Etiqueta | Significado |
|---|---|
| **Implementado (remoto)** | Configurado hoy en GitHub |
| **Ausente** | No existe en el remoto (verificado) |
| **Objetivo** | Diseño requerido antes de staging/prod / go-live Jardín 1 |
| **Decisión abierta** | Vendor o política pendiente de kick-off |

**Regla de oro:** este documento **nunca** lista valores de secretos. Solo nombres, scopes y dónde viven (GitHub Environment vs PaaS vs gestor Medina).

---

## 0. Snapshot del remoto (2026-07-27)

| Aspecto | Estado real |
|---|---|
| Visibilidad | **Público** (`visibility: public`, `private: false`) |
| Default branch | `main` (única rama) |
| Contenido remoto | Solo `README.md` (sin monorepo, sin `.github/workflows`) |
| GitHub Environments | **0** (`total_count: 0`) |
| Secrets de repositorio | **Ninguno** listado |
| Variables de repositorio | **Ninguna** listada |
| Deploy keys | **Ninguna** (`[]`) |
| Rulesets | **Ninguno** (`[]`) |
| Branch protection `main` | **No protegida** (HTTP 404) |
| Collaborators | Solo `PMedinaGarcia` (rol `admin`) |
| Teams | Ninguno vinculado al repo (`[]`) |
| Releases / tags | Ninguno |
| Actions | Habilitadas; `allowed_actions: all`; **sin workflows** |
| OIDC subject | Default (`use_default: true`); sin claim inmutable custom |
| Dependabot security updates | **enabled** |
| Vulnerability alerts | **enabled** (HTTP 204); alertas abiertas: **0** |
| Secret scanning | **enabled** |
| Secret scanning push protection | **enabled** |
| Secret scanning non-provider patterns | **disabled** |
| Secret scanning validity checks | **disabled** |
| Code scanning | **Sin análisis** (`no analysis found`) |
| Webhooks de repo | Ninguno |
| Licencia / topics | Sin licencia SPDX; topics vacíos |

Consecuencia: el gobierno de secretos y deploys en GitHub es **casi 100 % objetivo**. Lo único ya útil en seguridad es Dependabot + secret scanning (+ push protection).

---

## 1. Environments (dev / staging / prod) en GitHub

### 1.1 Modelo de entornos de producto vs GitHub Environments

Fuente de verdad operativa: [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §5 y [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) §3.

| Entorno de producto | Propósito | Environment GitHub **objetivo** | Protección objetivo |
|---|---|---|---|
| **dev** (local) | Desarrollo diario; Compose; tunnels | Opcional: `development` | Sin required reviewers; secretos solo sandbox |
| **staging** | UAT Tres Cielos; canales de prueba | `staging` | Wait timer opcional; deployment branches = `main` + tags `v*` o rama `release/*` |
| **prod** | Go-live Jardín 1 | `production` | **Required reviewers ≥ 1** (Medina); wait timer 5–15 min; solo tags `v*` o `workflow_dispatch` desde `main` |

**Estado real:** Environments **Ausente**. No hay `development`, `staging` ni `production` en el API.

### 1.2 Configuración objetivo por Environment

| Setting | `development` | `staging` | `production` |
|---|---|---|---|
| Required reviewers | No | Recomendado 0–1 | **Sí (≥ 1)** — Medina / admin |
| Wait timer | 0 | 0–5 min | 5–15 min |
| Prevent self-review | N/A | Preferible | **Sí** si hay ≥2 humanos |
| Deployment branches | Todas / `main` | `main`, `release/*` | Solo `main` + tags semver |
| Environment secrets | Claves sandbox | UAT Meta/Twilio/LLM | Prod **solo** aquí (no a nivel repo) |
| Environment variables | URLs panel/API staging | URLs UAT | URLs prod |

### 1.3 Separación obligatoria (producto)

Alineado a INF-4 / NF-R-4 ([../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md) §6–7):

1. Una `DATABASE_URL` distinta por Environment.
2. Bibliotecas de conocimiento/catálogo **no** compartidas entre staging y prod.
3. Meta/Twilio de prueba ≠ producción.
4. Deploy a `production` **nunca** automático desde PR; solo tras UAT firmado ([../producto/02-fases-golive.md](../producto/02-fases-golive.md) G1–G11 vía setup §10).

### 1.4 Mapa Environment → workloads

| Environment | Qué despliega (objetivo) | Job Actions típico |
|---|---|---|
| `staging` | API Nest + worker + panel Next + migrate | `deploy-staging` ([03-actions-ci-cd](03-actions-ci-cd.md)) |
| `production` | Idem, aislado | `deploy-prod` con aprobación |
| `development` | Opcional: preview / smoke contra sandbox | Manual |

Detalle de pipelines: [03-actions-ci-cd.md](03-actions-ci-cd.md).

---

## 2. Secrets y variables — nombres y mapa vs setup

### 2.1 Capas de almacenamiento (objetivo)

| Capa | Qué guardar | Quién lee | Estado |
|---|---|---|---|
| **GitHub Environment secrets** | Credenciales usadas **solo** por Actions (deploy, migrate CI, smoke) | Workflows con `environment:` | **Ausente** |
| **GitHub repository secrets** | Credenciales compartidas entre envs (evitar si es posible) | Todos los workflows | **Ausente** — preferir Environment |
| **GitHub variables** (no secretas) | URLs públicas, flags no sensibles (`APP_ENV`, `NEXT_PUBLIC_*` no secretos) | Workflows / docs | **Ausente** |
| **PaaS / runtime** (Vercel, ECS, etc.) | Runtime de API/panel en vivo | Contenedores / funciones | **Decisión abierta** (vendor) |
| **Gestor Medina** (Vault / Secrets Manager / Doppler…) | Fuente de verdad + rotación | Ops Medina | **Pendiente** ([setup/03](../setup/03-infraestructura-setup.md) §2.4) |
| **`.env` local gitignored** | Solo máquina del dev | Dev local | Objetivo post-scaffold; **nunca** commit |

**Prohibido:** secretos en git, en issues/PRs, en logs de CI, en imágenes Docker bakeadas.

### 2.2 Convención de nombres GitHub

Prefijos sugeridos (ilustrativos):

| Prefijo | Uso |
|---|---|
| (sin prefijo) | Igual que variable de app: `DATABASE_URL`, `JWT_SECRET` |
| `GH_` | Solo meta de CI (p. ej. `GH_TOKEN` si se necesita API) — evitar PAT de larga vida; preferir `GITHUB_TOKEN` / OIDC |
| Variables | Misma ortografía que env de app; valores no secretos |

Scopes:

```
Repository secrets     → evitar para prod
Environment:staging    → secretos UAT
Environment:production → secretos prod
```

### 2.3 Inventario backend / worker → GitHub

Fuente: [../setup/02-backend-setup.md](../setup/02-backend-setup.md) §3, [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) §7.1, [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §4.

| Nombre (secreto/variable) | Tipo | Dev | Staging GH Env | Prod GH Env | Notas |
|---|---|---|---|---|---|
| `NODE_ENV` | variable | local | `production` | `production` | Runtime suele fijarlo el PaaS |
| `APP_ENV` | variable | `development` | `staging` | `production` | Distinguir logs |
| `PORT` | variable | `3001` | PaaS | PaaS | |
| `DATABASE_URL` | **secret** | local | **sí** | **sí** | Nunca reutilizar entre envs |
| `DATABASE_URL_DIRECT` | **secret** | opcional | opcional | opcional | Migraciones si hay pooler |
| `REDIS_URL` | **secret** | local | si BullMQ | si BullMQ | Condicional |
| `QUEUE_DRIVER` | variable | `inline`/`bullmq` | elegido | elegido | |
| `JWT_SECRET` / `SESSION_SECRET` | **secret** | local | **sí** | **sí** | Rotación → re-login |
| `JWT_EXPIRES_IN` | variable | sí | sí | sí | |
| `AUTH_COOKIE_NAME` | variable | | | | |
| `AUTH_COOKIE_SECURE` | variable | `false` local | `true` | `true` | |
| `CORS_ORIGINS` | variable | localhost | URL panel staging | URL panel prod | Allowlist exacta |
| `PUBLIC_API_URL` | variable | tunnel | `https://api.staging…` | `https://api…` | |
| `META_APP_ID` | variable o secret | test | UAT | prod | |
| `META_APP_SECRET` | **secret** | test | UAT | prod | Firma webhook |
| `META_VERIFY_TOKEN` | **secret** | test | UAT | prod | Challenge GET |
| `META_PAGE_ACCESS_TOKEN` | **secret** | test | UAT | prod | |
| `TWILIO_ACCOUNT_SID` | **secret** | sandbox | test | prod | |
| `TWILIO_AUTH_TOKEN` | **secret** | sandbox | test | prod | |
| `TWILIO_WHATSAPP_FROM` | variable/secret | | | | |
| `TWILIO_WEBHOOK_AUTH` | **secret** | | recomendada | recomendada | |
| `LLM_API_KEY` / provider key | **secret** | sí | sí | sí | Preferible proyectos separados |
| `LLM_MODEL` | variable | | | | |
| `EMBEDDINGS_API_KEY` | **secret** | | | | Puede = LLM |
| `EMBEDDINGS_MODEL` | variable | | | | Dimensión fija |
| `COHERE_API_KEY` | **secret** | sí | sí | sí | Rerank |
| `RERANK_THRESHOLD` | variable | `0.85` | `0.85` | `0.85` | Producto C5 |
| `SMTP_*` / `EMAIL_API_KEY` | **secret** | Mailhog | test | prod | Si alertas pactadas |
| `EMAIL_FROM` | variable | | | | |
| `STORAGE_*` / `S3_*` | **secret** | opcional | si uploads | si uploads | |
| `RATE_LIMIT_WEBHOOK_*` | variable | laxo | medio | prod | |
| `CUPO_MENSUAL_MENSAJES` | variable | `1000` | `1000` | `1000` | |
| `FF_DEVOLVER_A_BOT` | variable | `false` | `false` | `false` | |
| `ACTIVE_SEDE_*` | variable | Jardín 1 | | Jardín 1 | G7 |

**Estado remoto:** ninguno de estos nombres existe aún como GitHub secret/variable.

### 2.4 Inventario frontend (panel) → GitHub / PaaS

Fuente: [../setup/01-frontend-setup.md](../setup/01-frontend-setup.md) §3, [../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md).

| Nombre | Tipo | ¿En GitHub Actions? | ¿Runtime panel? | Prohibido |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | variable | build/deploy web | **sí** | — |
| `NEXT_PUBLIC_API_PREFIX` | variable | sí | sí | — |
| `NEXT_PUBLIC_APP_ENV` | variable | sí | sí | — |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | variable | sí | `es-MX` | — |
| `NEXT_PUBLIC_SLA_ESCALACION_MIN` / `_MAX` | variable | sí | `15` / `30` | — |
| `NEXT_PUBLIC_REALTIME_URL` | variable | sí | opcional | — |
| `NEXT_PUBLIC_FEATURE_*` / `NEXT_PUBLIC_FF_*` | variable | sí | flags | — |
| `API_INTERNAL_URL` | **secret** o var privada | SSR | server-only | No en browser |
| `SESSION_SECRET` | **secret** | si BFF | server-only | No `NEXT_PUBLIC_` |

**Nunca** como secretos/vars del panel (ni Actions del job `web` que las inyecte a client bundle):

`DATABASE_URL`, `META_*`, `TWILIO_*`, `COHERE_API_KEY`, `LLM_*`, `EMBEDDINGS_*`, `JWT_SECRET` de API (salvo diseño BFF explícito documentado).

### 2.5 Secrets solo de CI (objetivo)

| Nombre | Uso | Scope |
|---|---|---|
| Credenciales OIDC / cloud role | Push imagen, deploy | Environment |
| `CODECOV_TOKEN` u equivalente | Opcional coverage | Repo (bajo riesgo) |
| Registry token | Si no OIDC | Environment |
| Smoke user password UAT | Login smoke post-deploy | `staging` only — rotar; no prod humano real |

Preferir **OIDC** (§3) sobre PATs y access keys estáticas.

### 2.6 Matriz “dónde vive cada secreto” (objetivo go-live)

| Secreto | Local `.env` | GH Env staging | GH Env production | PaaS runtime | Gestor Medina |
|---|---|---|---|---|---|
| `DATABASE_URL` | sí | sí (migrate/smoke) | sí | **sí** | **fuente** |
| Meta / Twilio | sandbox | UAT | prod | **sí** | **fuente** |
| LLM / Cohere | sí | sí | sí | **sí** | **fuente** |
| `JWT_SECRET` | sí | sí | sí | **sí** | **fuente** |
| `NEXT_PUBLIC_*` | sí | vars | vars | **sí** | opcional |

GitHub no sustituye el gestor Medina: es un **consumidor** para CI/CD.

### 2.7 Criterios de setup / producto relacionados

| ID | Relación |
|---|---|
| NF-S-3 | Secretos fuera del repo; separados por entorno |
| INF-4 | `dev` / `staging` / `prod` aislados |
| §8.2 setup 04 | Secrets en CI no hardcode; scan básico |
| §10.2 / §10.5 | Credenciales prod + runbook rotación |

---

## 3. Deploy keys / OIDC / cloud credentials (objetivo)

### 3.1 Estado real

| Mecanismo | Estado |
|---|---|
| Deploy keys | **Ausente** (`GET /keys` → `[]`) |
| Secrets cloud (`AWS_ACCESS_KEY_ID`, etc.) | **Ausente** |
| OIDC customization | Default subject; `use_immutable_subject: false` |
| Actions permissions | Enabled; `allowed_actions: all`; `sha_pinning_required: false` |

### 3.2 Recomendación de arquitectura de identidad para CI

Orden de preferencia Medina:

1. **OIDC federado** (GitHub → AWS IAM / GCP WIF / Azure Fed Creds / Vercel OIDC) — sin keys de larga vida en GitHub Secrets.
2. **Tokens de corta vida** del PaaS emitidos en el job.
3. **Deploy keys** solo si un host necesita `git clone` de repo privado (hoy el repo es **público**; deploy keys aportan poco salvo cambio a privado).
4. **PATs de usuario** — último recurso; scope mínimo; expiración; nunca en logs.

### 3.3 OIDC — diseño objetivo

| Elemento | Objetivo |
|---|---|
| Trust | Cloud confía en `token.actions.githubusercontent.com` |
| Subject condition | `repo:PMedinaGarcia/tres-cielos-sys:environment:production` (y análogo staging) |
| Permissions Actions | `id-token: write`, `contents: read` |
| Roles | `ci-staging-deploy`, `ci-prod-deploy` con mínimo privilegio (push image, update service, **no** IAM admin) |
| Immutable subject | Evaluar `use_immutable_subject: true` cuando el cloud lo soporte |

Ejemplo de claim útil (conceptual):

```
sub: repo:PMedinaGarcia/tres-cielos-sys:environment:production
```

### 3.4 Deploy keys — cuándo usarlas

| Caso | ¿Usar deploy key? |
|---|---|
| Repo público, deploy vía registry/OIDC | **No** |
| Servidor legacy que hace `git pull` | Sí, **read-only**, una key por host, rotación anual |
| Acceso write desde CI | Preferir `GITHUB_TOKEN` o app GitHub, no deploy key write |

### 3.5 Hardening de Actions (objetivo)

| Control | Objetivo | Hoy |
|---|---|---|
| `allowed_actions` | `selected` + allowlist de actions verificadas | `all` |
| Pinning SHA de actions de terceros | **Sí** (`sha_pinning_required` o pin en YAML) | `false` |
| Fork PRs y secrets | No exponer Environment secrets a forks | N/A (aún sin workflows) |
| `permissions:` mínimo por job | Default `contents: read` | N/A |

Vendor cloud concreto: **Decisión abierta** ([setup/03](../setup/03-infraestructura-setup.md) §1.3).

---

## 4. Protección de `main`, rulesets, required reviewers

### 4.1 Estado real

| Control | Estado |
|---|---|
| Classic branch protection en `main` | **Ausente** |
| Repository rulesets | **Ausente** (`[]`) |
| Rules evaluadas en `main` | Ninguna (`[]`) |
| Required status checks | Ninguno (no hay CI) |
| Required PR reviews | No |
| CODEOWNERS | No existe en remoto |
| Delete branch on merge | `false` |
| Allow auto-merge | `false` |

Cualquier colaborador con write (hoy solo el owner) puede pushear directo a `main`.

### 4.2 Política objetivo (ruleset recomendado)

Crear un **ruleset** `protect-main` (preferible a classic protection):

| Regla | Valor objetivo |
|---|---|
| Target | Branch `main` |
| Enforcement | Active |
| Restrict deletions | Sí |
| Restrict force pushes | Sí |
| Require pull request | Sí |
| Required approvals | **≥ 1** (go-live: ≥ 1 Medina; ideal 2 si hay equipo) |
| Dismiss stale reviews | Sí |
| Require review from Code Owners | Sí, cuando exista `CODEOWNERS` |
| Require status checks | Lint, typecheck, unit/contract (nombres exactos en [03-actions-ci-cd](03-actions-ci-cd.md)) |
| Require conversation resolution | Sí |
| Require linear history | Preferible (squash) |
| Block bypass except admins | Admins solo en emergencia documentada |

Environment `production`: required reviewers **adicionales** al merge (gate de deploy ≠ gate de merge).

### 4.3 Relación con flujo de PRs

Detalle de convenciones, templates y quién aprueba: [02-flujo-trabajo-y-prs.md](02-flujo-trabajo-y-prs.md).

Criterio calidad producto: CI verde obligatorio para merge a `main` ([../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md) §8.2).

---

## 5. Seguridad: Dependabot, secret scanning, code scanning

### 5.1 Estado real vs recomendado

| Capacidad | Estado remoto | Recomendado pre go-live |
|---|---|---|
| Dependabot security updates | **enabled** | Mantener; añadir `dependabot.yml` para version updates (npm) cuando exista lockfile |
| Dependabot alerts | **0** abiertas | Revisar semanalmente en ops |
| Secret scanning | **enabled** | Mantener |
| Push protection | **enabled** | Mantener |
| Non-provider patterns | **disabled** | **Activar** (detecta JWT/API keys genéricas) |
| Validity checks | **disabled** | Activar si el plan lo permite |
| Code scanning (CodeQL u otro) | **Sin análisis** | Activar CodeQL default + workflow en PR/`main` |
| Private vulnerability reporting | No verificado / N/A | Activar (repo público) |
| Security policy `SECURITY.md` | Ausente en remoto | **Objetivo** — contacto Medina, no divulgar secretos en issues públicos |

### 5.2 Implicación de repo **público**

El remoto es **público** mientras el sistema maneja leads, webhooks y PII operativa. Riesgos:

| Riesgo | Mitigación |
|---|---|
| Filtración accidental de `.env` / keys en commit | Push protection (ya on) + review + code scanning |
| Issues/PRs públicos con datos de cliente | Política: **cero PII** en tracker público; migrar a privado o org privada antes de UAT real |
| Enumeración de roadmap/docs sensibles | Docs de producto ya están/irán al workspace; alinear si el remoto solo debe espejar docs sanitizadas |
| Supply chain Actions | Allowlist + pin SHA |

**Recomendación de gobierno:** antes de staging con datos UAT reales o cualquier secreto de cliente, evaluar pasar el repo a **privado** (o org Medina con SSO). **Decisión abierta** comercial/legal.

### 5.3 Code scanning — objetivo

```
PR / push main
  → CodeQL analyze (javascript-typescript) cuando exista código
  → Fallar check en findings High/Critical
```

Hasta haber scaffold: no hay SARIF que consumir (estado actual coherente con “solo README”).

### 5.4 Secret scanning — runbook breve

1. Alerta → rotar credencial en origen (Meta/Twilio/LLM/DB).
2. Invalidar la filtrada; no “solo borrar del git history” sin rotar.
3. Documentar incidente en canal Medina (sin pegar el secreto).
4. Verificar push protection no bypassed por admin sin justificación.

Alineado a NF-S-3 y runbook de rotación ([setup/03](../setup/03-infraestructura-setup.md) §7.4).

---

## 6. Releases y versionado

### 6.1 Estado real

| Artefacto | Estado |
|---|---|
| GitHub Releases | Ninguno |
| Tags | Ninguno |
| SemVer en código | N/A (sin package aún) |

### 6.2 Esquema objetivo

| Elemento | Convención |
|---|---|
| Versionado | **SemVer** `MAJOR.MINOR.PATCH` en monorepo (versión de producto / release train v1) |
| Tags | `v1.0.0`, `v1.1.0`, … |
| Release GitHub | Changelog generado (Keep a Changelog o notes de PR squash) |
| Deploy prod | Preferible desde tag `v*` + Environment `production` |
| Pre-release | `v1.2.0-rc.1` → solo `staging` |
| Hotfix | `v1.2.1` desde `main` con PR acelerado + checks verdes |

### 6.3 Qué versionar en v1

- App API + worker + panel como **un** release train (mismo tag).
- Migraciones Prisma: backward-compatible en el mismo release; breaking migrations = MAJOR + runbook.
- Documentación `docs/`: no requiere tag; viaja en el mismo commit.

### 6.4 Relación con go-live

El **GO** de producto ([../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md) §10.6) no es un GitHub Release automático: es acta humana. El Release `v1.0.0` debería coincidir con ese GO y apuntar al commit desplegado en prod.

---

## 7. Acceso, colaboradores y equipos

### 7.1 Estado real

| Actor | Rol | Permisos |
|---|---|---|
| `PMedinaGarcia` | `admin` | admin/maintain/push/triage/pull |

- Sin teams del API (`GET /teams` → `[]`).
- Owner es usuario personal (no org `PMedinaGarcia` — `GET /orgs/PMedinaGarcia` 404).
- Outside collaborators adicionales: no listados.

### 7.2 Modelo de acceso objetivo (pre go-live)

| Rol GitHub | Quién | Qué puede |
|---|---|---|
| **Admin** | Medina Systems (1–2 personas) | Settings, secrets, Environments, bypass emergencia |
| **Maintain** / **Write** | Devs del monorepo | PRs, merges tras checks; **sin** editar secrets prod |
| **Triage** | QA / PM | Issues/PRs sin push |
| **Read** | Stakeholders solo lectura | Clone; sin Actions write |

Reglas:

1. Nadie del cliente Tres Cielos necesita acceso a Environment `production` secrets (solo operadores Medina).
2. Reviewers de Environment `production` ⊆ admins Medina.
3. Cuando exista org: equipos `medina-eng`, `medina-ops`; CODEOWNERS apunta a esos teams.
4. 2FA obligatorio en todas las cuentas con write/admin.

### 7.3 Separación GitHub vs panel RBAC

| Plano | Roles |
|---|---|
| GitHub | Admin / Write / Triage (ingeniería) |
| Panel producto | `asesor` / `coordinador` / `admin` ([backend/06](../backend/06-guards-y-rbac.md)) |

Un asesor operativo **no** requiere acceso al repo. Un admin de panel **no** implica admin de GitHub.

### 7.4 Auditoría de acceso

Checklist periódico (mensual pre go-live; trimestral post):

- [ ] Lista de collaborators = roster Medina
- [ ] Secrets prod: quién puede leer (GitHub UI audit)
- [ ] PATs personales revocados si se usaron
- [ ] Deploy keys huérfanas = 0

---

## 8. Checklist de gobierno para go-live

Completar **antes** de declarar Infra prod OK + GO de producto. Complementa [../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md) §10.5 y [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) §11.3.

### 8.1 Visibilidad y acceso

- [ ] Decisión documentada: repo **privado** vs público (recomendado privado para UAT/prod con secretos)
- [ ] Collaborators/teams alineados a roster Medina; 2FA on
- [ ] Cliente Tres Cielos sin acceso a secrets de GitHub

### 8.2 Protección de código

- [ ] Ruleset activo en `main` (PR + approvals + status checks)
- [ ] Force push y delete de `main` bloqueados
- [ ] CODEOWNERS para `apps/`, `packages/`, `.github/`, Prisma
- [ ] `delete_branch_on_merge` habilitado

### 8.3 Environments y secretos

- [ ] Environments `staging` y `production` creados
- [ ] Required reviewers en `production`
- [ ] Inventario §2 cargado **por entorno** (nombres verificados; valores solo en gestor + GH/PaaS)
- [ ] Cero secretos en git / historial limpio o rotado si hubo fuga
- [ ] `.env.example` en scaffold sin valores reales
- [ ] Rotación Meta/Twilio/JWT/LLM ensayada en staging

### 8.4 Identidad CI → cloud

- [ ] OIDC (o equivalente) configurado; sin access keys de larga vida en prod
- [ ] Roles cloud de mínimo privilegio
- [ ] Actions allowlist + pin SHA en workflows críticos

### 8.5 Seguridad automatizada

- [ ] Dependabot + secret scanning + push protection (ya on) **y** non-provider patterns on
- [ ] CodeQL (u otro) en verde en `main`
- [ ] `SECURITY.md` publicado
- [ ] Private vulnerability reporting on (si público)

### 8.6 Releases y deploy

- [ ] Primer tag `v*` de go-live alineado a acta GO
- [ ] Workflow deploy prod solo vía Environment `production`
- [ ] Rollback documentado (release/imagen anterior)

### 8.7 Evidencias (tipo setup §11)

| Evidencia | Ejemplo |
|---|---|
| Screenshot / export settings | Ruleset + Environments (sin valores de secrets) |
| Lista de nombres de secrets | Checklist firmado ops |
| Acta restore + deploy | INF-5 + smoke post-deploy |
| CI badge verde | §8 calidad |

---

## 9. Criterios de éxito de gobierno GitHub

Criterios **binarios** propios de este dominio. Un “gobierno OK” es necesario pero no suficiente para GO de producto.

| ID | Criterio | Umbral | Evidencia |
|---|---|---|---|
| GH-G-1 | Environments `staging` y `production` existen | Ambos | API `/environments` |
| GH-G-2 | Secrets de prod solo en Environment `production` (o PaaS/gestor), no en repo root | 0 secrets prod a nivel repo | `gh secret list` + política |
| GH-G-3 | Inventario de nombres §2 cubierto para el corte (canales del GO) | 100 % nombres presentes donde aplica | Checklist ops |
| GH-G-4 | `main` protegida con PR + ≥1 approval + checks CI | Activo | Ruleset |
| GH-G-5 | Deploy prod requiere reviewer de Environment | Activo | Environment protection |
| GH-G-6 | OIDC o credenciales de corta vida para cloud | Sin keys estáticas prod | Config cloud + workflow |
| GH-G-7 | Secret scanning + push protection ON | ON | `security_and_analysis` |
| GH-G-8 | Code scanning operativo en código de app | Análisis en `main` | Code scanning alerts API / check |
| GH-G-9 | Dependabot security updates ON | ON | Ya cumplido hoy |
| GH-G-10 | Acceso: solo roles Medina necesarios; 2FA | Roster = collaborators | Audit |
| GH-G-11 | Release SemVer alineado a deploy prod | Tag `v*` = commit prod | Release + URL deploy |
| GH-G-12 | Cero secretos en historial git del commit de GO | Scan limpio / rotación hecha | Secret scanning + acta |
| GH-G-13 | Aislamiento staging ≠ prod (URLs, DB, Meta/Twilio) | Sin cruce | Smoke + inventario |
| GH-G-14 | Documentación de gobierno actualizada post-cambios de settings | Este doc + índice | PR docs |

### 9.1 Mapeo a criterios de producto / setup

| Gobierno | Setup / producto |
|---|---|
| GH-G-2, G-3, G-12, G-13 | NF-S-3, INF-4, §10.2 |
| GH-G-4 | §8.2 CI verde para merge |
| GH-G-5, G-6, G-11 | INF prod OK, rollback, §10.5 |
| GH-G-7–9 | §8 secrets scan; higiene supply chain |
| GH-G-10 | Separación ops Medina vs roles panel |

### 9.2 Definición binaria

| Nivel | Definición |
|---|---|
| **Gobierno GitHub mínimo** | G-7 + G-9 (hoy) + decisión de visibilidad documentada |
| **Gobierno staging OK** | G-1 (staging) + G-3 parcial + G-4 + workflows CI |
| **Gobierno prod / go-live OK** | **Todos** GH-G-1…14 aplicables al corte |

---

## 10. Gaps

| # | Gap | Impacto | Prioridad |
|---|---|---|---|
| G-GH-1 | Repo **público** sin código aún, pero inadecuado para secretos/PII de UAT-prod | Exposición futura | P0 decisión |
| G-GH-2 | **0 Environments** | No hay gate de deploy ni secrets por entorno | P0 pre-staging |
| G-GH-3 | **0 secrets / variables** en GitHub | Esperado hoy; bloqueará CI deploy | P0 con primer pipeline |
| G-GH-4 | `main` **sin** branch protection / rulesets | Push directo; sin reviews obligatorias | P0 al primer colaborador o scaffold |
| G-GH-5 | Sin CODEOWNERS / teams | Ownership de review informal | P1 |
| G-GH-6 | Sin workflows Actions | Sin checks required posibles | P0 (ver doc 03) |
| G-GH-7 | Code scanning sin análisis | Sin SAST en PR | P1 al existir TS/JS |
| G-GH-8 | Non-provider patterns y validity checks OFF | Menor cobertura de secretos genéricos | P1 |
| G-GH-9 | Sin OIDC / deploy keys / cloud IAM | No hay camino seguro de deploy | P0 con vendor |
| G-GH-10 | Solo 1 admin humano | Bus factor; sin dual control real en prod | P1 |
| G-GH-11 | Sin Releases/tags | Sin ancla de rollback versionado | P1 pre-prod |
| G-GH-12 | `allowed_actions: all`, sin SHA pinning | Supply chain Actions | P1 |
| G-GH-13 | Sin `SECURITY.md` / política de disclosure | Issues públicos riesgosos si el repo sigue público | P1 |
| G-GH-14 | Gestor de secretos Medina y vendor cloud **no** elegidos | Bloquea materialización de §2–3 | P0 kick-off |
| G-GH-15 | Remoto solo `README.md` vs workspace local rico en `docs/` | Divergencia clone remoto ↔ docs locales | P1 sync |
| G-GH-16 | Sin organización GitHub (cuenta usuario) | Teams, SSO, policies de org limitadas | P2 |

---

## 11. Referencias cruzadas

| Doc | Uso |
|---|---|
| [00-indice.md](00-indice.md) | Entrada a la carpeta GitHub |
| [01-repositorio-y-clonado.md](01-repositorio-y-clonado.md) | Identidad del repo, clone, estructura remota |
| [02-flujo-trabajo-y-prs.md](02-flujo-trabajo-y-prs.md) | Ramas, PRs, reviews |
| [03-actions-ci-cd.md](03-actions-ci-cd.md) | Pipelines, checks, deploy jobs |
| [../setup/01-frontend-setup.md](../setup/01-frontend-setup.md) | Env panel |
| [../setup/02-backend-setup.md](../setup/02-backend-setup.md) | Env API/worker |
| [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) | Entornos, CI objetivo, secretos, checklists |
| [../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md) | NF-S, INF, CI, go-live |
| [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) | Contrato de secretos y entornos |
| [../frontend/06-auth-y-config.md](../frontend/06-auth-y-config.md) | Qué puede ser `NEXT_PUBLIC_*` |
| [../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) | Webhooks ≠ JWT panel |

### Comandos de verificación (sin exponer valores)

```bash
gh api repos/PMedinaGarcia/tres-cielos-sys/environments
gh secret list -R PMedinaGarcia/tres-cielos-sys
gh secret list -R PMedinaGarcia/tres-cielos-sys --env staging
gh secret list -R PMedinaGarcia/tres-cielos-sys --env production
gh api repos/PMedinaGarcia/tres-cielos-sys/rulesets
gh api repos/PMedinaGarcia/tres-cielos-sys/branches/main/protection
gh api repos/PMedinaGarcia/tres-cielos-sys --jq .security_and_analysis
gh api repos/PMedinaGarcia/tres-cielos-sys/collaborators --jq ".[].login"
gh release list -R PMedinaGarcia/tres-cielos-sys
```

---

## 12. Criterio de cierre de este entregable

Quedan documentados, con distinción **Implementado (remoto)** vs **Objetivo**:

1. Modelo de GitHub Environments vs entornos de producto  
2. Inventario de **nombres** de secrets/variables mapeado a setup 01–03  
3. Estrategia Deploy keys / OIDC / cloud credentials  
4. Protección de `main` y rulesets  
5. Estado y recomendación de Dependabot, secret scanning, code scanning  
6. Releases y SemVer  
7. Acceso/colaboradores/equipos  
8. Checklist de gobierno para go-live  
9. Criterios binarios GH-G-1…14  
10. Registro de gaps G-GH-1…16  

**Ningún valor secreto** aparece en este documento. La materialización en GitHub/PaaS queda pendiente del scaffold, del vendor cloud y del kick-off de secretos Medina.
