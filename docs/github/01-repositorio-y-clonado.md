# GitHub — repositorio remoto y clonado

Documentación factual del repositorio remoto **Event Master System / Tres Cielos** en GitHub, contrastada con el workspace local de documentación y el **monorepo objetivo** descrito en `docs/`.

| Campo | Valor |
|---|---|
| Fecha de inspección | **2026-07-27** |
| Método | `gh repo view`, `gh api` (contents, branches, workflows, rulesets, collaborators, commits) + clonado a directorio temporal |
| Naturaleza de este doc | Inventario de lo que **existe** en el remoto vs lo que es **objetivo/pendiente** según docs locales |
| Repo inspeccionado | [`PMedinaGarcia/tres-cielos-sys`](https://github.com/PMedinaGarcia/tres-cielos-sys) |

**Leyenda**

| Etiqueta | Significado |
|---|---|
| **EXISTE** | Verificado en el remoto GitHub en la fecha de inspección |
| **OBJETIVO** | Definido en documentación local (`docs/`); aún no está en el remoto |
| **GAP** | Ausencia relevante para contribuir o operar el producto |

---

## Índice

1. [Identidad del repositorio](#1-identidad-del-repositorio)
2. [Cómo clonar](#2-cómo-clonar)
3. [Estructura del remoto vs monorepo objetivo](#3-estructura-del-remoto-vs-monorepo-objetivo)
4. [README remoto y qué falta](#4-readme-remoto-y-qué-falta)
5. [Archivos de gobernanza](#5-archivos-de-gobernanza)
6. [Relación con el workspace local TRES-CIELOS-SYS](#6-relación-con-el-workspace-local-tres-cielos-sys)
7. [Checklist post-clone](#7-checklist-post-clone)
8. [Criterios de éxito: repo listo para contribuir](#8-criterios-de-éxito-repo-listo-para-contribuir)
9. [Gaps](#9-gaps)
10. [Referencias cruzadas](#10-referencias-cruzadas)

---

## 1. Identidad del repositorio

### 1.1 Datos verificados (**EXISTE**)

| Atributo | Valor | Notas |
|---|---|---|
| Owner | `PMedinaGarcia` | Usuario GitHub; único collaborator con rol `admin` |
| Nombre | `tres-cielos-sys` | Slug del repo |
| URL HTTPS | `https://github.com/PMedinaGarcia/tres-cielos-sys` | |
| URL SSH | `git@github.com:PMedinaGarcia/tres-cielos-sys.git` | |
| Visibilidad | **Public** | `isPrivate: false`, `visibility: PUBLIC` |
| Default branch | **`main`** | Única rama remota |
| Protección de rama | **No** | `protected: false` en `main`; rulesets: `[]` |
| Descripción | *(vacía)* | Campo `description` vacío |
| Homepage | *(vacía)* | |
| Topics / tags | *(ninguno)* | `repositoryTopics: null` |
| Licencia | *(ninguna)* | `licenseInfo: null`; no hay archivo `LICENSE` |
| Lenguaje primario | *(ninguno)* | Sin código de aplicación; GitHub no detecta lenguaje |
| Tamaño | ~0 KB | Solo README mínimo |
| Creado / primer push | 2026-07-27T22:11:29Z / 22:11:30Z | Commit único: `Initial commit` (`2afc30c`) |
| Issues | Habilitados | `open_issues_count: 0` |
| Projects | Habilitados | |
| Wiki | Habilitada | No sustituye `docs/` del producto |
| Discussions | Deshabilitadas | |
| GitHub Pages | Deshabilitado | |
| Forks / watchers | 0 / 0 | |
| Archivo / deshabilitado | No / No | |

### 1.2 Seguridad GitHub (ajustes de cuenta/repo)

| Función | Estado verificado |
|---|---|
| Dependabot security updates | **enabled** |
| Secret scanning | **enabled** |
| Secret scanning push protection | **enabled** |
| Secret scanning non-provider patterns | disabled |
| Secret scanning validity checks | disabled |

Estos controles protegen contra secretos en pushes futuros; **no** implican que exista código, CI o políticas de branch.

### 1.3 Qué **no** es este repo hoy

- No es un monorepo con `apps/` / `packages/`.
- No es un mirror del workspace local `TRES-CIELOS-SYS` (ese workspace **no** está versionado en este remoto al momento de la inspección).
- No contiene la documentación profunda en `docs/` (solo vive en el disco local hasta que se publique).

### 1.4 Identidad de producto (contexto, no metadata GitHub)

Según docs locales, el producto es **Event Master System** (Tres Cielos / Medina Systems): CRM + chatbot Meta/WhatsApp + asignación, con arquitectura **Agentic RAG**. Stack de referencia: NestJS, Next.js, Prisma, PostgreSQL + pgvector + FTS. Ver [../README.md](../README.md).

---

## 2. Cómo clonar

### 2.1 Prerrequisitos

| Herramienta | Uso |
|---|---|
| **Git** 2.x | Clonado y trabajo local |
| **GitHub CLI (`gh`)** | Autenticación, clone y consulta de metadata (recomendado) |
| Cuenta GitHub | Necesaria para **push** / PRs; el repo es **público**, así que el **clone de lectura** no requiere autenticación |

### 2.2 Permisos necesarios

| Acción | Repo público | Notas |
|---|---|---|
| `git clone` / `gh repo clone` (lectura) | Cualquiera | Sin colaborador |
| Issues / PRs (propuesta de cambio) | Cualquiera (vía fork) o collaborator | Hoy no hay templates de issue/PR |
| `git push` a `origin` | Collaborator con `push` (hoy solo owner `admin`) | Rama `main` **sin** protección |
| Admin (settings, collaborators, secrets) | Owner / admin | Solo `PMedinaGarcia` listado |

**Importante:** al ser público y `main` sin reglas de protección, un collaborator con write puede pushear directo a `main`. Eso es un **GAP de gobernanza** (ver §9).

### 2.3 Clonar con GitHub CLI (recomendado)

```bash
gh repo clone PMedinaGarcia/tres-cielos-sys
cd tres-cielos-sys
```

Clonar a un path explícito (útil si ya existe un directorio local con el mismo nombre):

```bash
gh repo clone PMedinaGarcia/tres-cielos-sys ./tres-cielos-sys-remote
```

En Windows, si el workspace de docs ya ocupa `Desktop\TRES-CIELOS-SYS`, clonar a un directorio **temporal** o con otro nombre para no sobrescribir:

```powershell
$tmp = Join-Path $env:TEMP "tres-cielos-sys-remote"
gh repo clone PMedinaGarcia/tres-cielos-sys $tmp
```

### 2.4 Clonar con HTTPS

```bash
git clone https://github.com/PMedinaGarcia/tres-cielos-sys.git
cd tres-cielos-sys
```

Para autenticar pushes HTTPS: Personal Access Token o `gh auth login` (credential helper).

### 2.5 Clonar con SSH

```bash
git clone git@github.com:PMedinaGarcia/tres-cielos-sys.git
cd tres-cielos-sys
```

Requiere clave SSH registrada en GitHub (`ssh -T git@github.com`).

### 2.6 Qué obtienes al clonar hoy (**EXISTE**)

Inspección post-clone (2026-07-27):

```
tres-cielos-sys/
├── .git/
└── README.md          # 17 bytes: "# tres-cielos-sys\n\n"
```

| Verificación | Resultado |
|---|---|
| Rama local | `main` tracking `origin/main` |
| Commits | 1 (`2afc30c` — *Initial commit*) |
| Working tree | Limpio |
| Contenido útil de app/docs | **Ninguno** más allá del título del README |

No hay `package.json`, `apps/`, `docs/`, Docker, ni `.github/`.

### 2.7 Autenticación `gh` (si aplica)

```bash
gh auth status
gh auth login   # solo si hace falta
```

Scopes típicos para contribuir: lectura/escritura de repo según el rol. Para solo clonar un repo público no es obligatorio.

---

## 3. Estructura del remoto vs monorepo objetivo

### 3.1 Árbol remoto real (**EXISTE**)

```
PMedinaGarcia/tres-cielos-sys (main)
└── README.md
```

Sin directorio `.github/`, sin código, sin docs versionadas.

### 3.2 Workspace local de documentación (disco, **no** en el remoto)

Path típico de trabajo de docs:

`c:\Users\Patricio\Desktop\TRES-CIELOS-SYS`

```
TRES-CIELOS-SYS/
├── docs/
│   ├── README.md
│   ├── producto/          # diseño, fases, criterios, escenarios
│   ├── backend/           # dominios, orquestador, RAG, ingesta, DTOs, RBAC
│   ├── frontend/          # superficies, estructura, routing, UI, API hooks…
│   ├── database/          # modelo conceptual, catálogo
│   ├── infrastructure/    # stack y entornos
│   ├── setup/             # frontend/backend/infra setup + criterios éxito
│   └── github/            # esta carpeta (docs de gobernanza GitHub)
└── Propuesta_TresCielos_SistemaLeads_MedinaSystems_v1.5.pdf
```

Al momento de la inspección: **no hay** carpeta `.git` en ese workspace → no está ligado como clone del remoto.

### 3.3 Monorepo objetivo (**OBJETIVO** — docs locales)

Propuesto en [../frontend/01-estructura.md](../frontend/01-estructura.md) §3 y reforzado en setup/infra:

```
TRES-CIELOS-SYS/                 # (o nombre del clone)
├── apps/
│   ├── api/                     # NestJS — API + puntos de entrada workers
│   └── web/                     # Next.js — panel operativo
├── packages/
│   └── shared/                  # Zod, enums, PanelAuthContext, types wire
├── docs/                        # Contratos de producto/ingeniería
├── docker-compose*.yml          # Postgres/pgvector (+ Redis si BullMQ) — pendiente
├── package.json / pnpm-workspace.yaml / lockfile
├── .env.example                 # Sin secretos reales
├── .gitignore
├── README.md                    # Onboarding real
└── ...
```

Alternativa aceptable en v1: `frontend/` en raíz en lugar de `apps/web/`, manteniendo la organización interna del panel. **No** microfrontends.

| Artefacto | Remoto hoy | Objetivo documentado |
|---|---|---|
| `README.md` mínimo | **EXISTE** | README de onboarding + enlaces a `docs/` |
| `docs/**` | Ausente | **OBJETIVO** — ya escrito en workspace local |
| `apps/api`, `apps/web` | Ausente | **OBJETIVO** — scaffold |
| `packages/shared` | Ausente | **OBJETIVO** |
| Prisma / migraciones | Ausente | **OBJETIVO** |
| Docker Compose | Ausente | **OBJETIVO** |
| CI (GitHub Actions) | Ausente (`workflows: []`) | **OBJETIVO** (mencionado como pendiente en setup infra) |
| IaC (Terraform/etc.) | Ausente | **OBJETIVO** / decisión abierta de vendor |

### 3.4 Distinción operativa

| Pregunta | Respuesta factual |
|---|---|
| ¿El clone de GitHub alcanza para desarrollar el producto? | **No.** Solo da un README vacío. |
| ¿Dónde está el conocimiento técnico hoy? | En el workspace local `docs/` (y PDF comercial). |
| ¿Cuándo el remoto “es” el monorepo? | Cuando se publique scaffold + docs + gobernanza y el clone coincida con la estructura objetivo. |

---

## 4. README remoto y qué falta

### 4.1 Contenido actual (**EXISTE**)

Archivo: `README.md` (17 bytes).

```markdown
# tres-cielos-sys

```

Es el README por defecto de creación del repo (título = nombre del repo). Un único commit: *Initial commit*.

### 4.2 Qué debería cubrir un README útil (**OBJETIVO**)

Alineado a [../README.md](../README.md) (índice de docs) y a setup:

1. **Nombre de producto** — Event Master System / Tres Cielos (no solo el slug).
2. **Qué es / qué no es** — CRM + WhatsApp/Meta + Agentic RAG; no agente libre multi-día.
3. **Stack de referencia** — NestJS, Next.js, Prisma, PostgreSQL + pgvector + FTS.
4. **Estado del repo** — document-only vs scaffold listo (hoy: esqueleto vacío en remoto).
5. **Cómo clonar** — HTTPS / SSH / `gh` (este documento).
6. **Quick start** — cuando exista: Node LTS, pnpm, Compose, migraciones, `web` + `api`.
7. **Enlace a documentación** — `docs/README.md` y orden de lectura.
8. **Contribución** — ramas, PR, CODEOWNERS, CI requerida (cuando existan).
9. **Licencia / confidencialidad** — hoy el repo es **público** sin LICENSE: decisión pendiente (ver gaps).
10. **Contacto / owner** — Medina Systems / maintainers.

### 4.3 Desalineación README remoto vs docs locales

| Tema | README GitHub | Docs locales |
|---|---|---|
| Producto nombrado | Solo slug | Event Master / Tres Cielos completo |
| Arquitectura | No | Agentic RAG, dominios, superficies |
| Setup | No | `docs/setup/01–04` |
| Criterios de éxito / go-live | No | `docs/setup/04`, `docs/producto/02–03` |

Hasta que se suba `docs/` y se reescriba el README, un contribuidor que solo mire GitHub **no** tiene contexto de producto.

---

## 5. Archivos de gobernanza

Inventario verificado por API (`404` = no existe en el remoto).

### 5.1 Tabla de estado

| Artefacto | Estado remoto | Notas |
|---|---|---|
| `.gitignore` | **Ausente** | GAP crítico antes de cualquier scaffold (node_modules, `.env`, dist, IDE) |
| `LICENSE` / `licenseInfo` | **Ausente** | Repo público sin licencia explícita |
| `.editorconfig` | **Ausente** | **OBJETIVO** recomendado (UTF-8, LF/CRLF, indent) |
| `CODEOWNERS` | **Ausente** | Sin owners path-based |
| `.github/` | **Ausente** | Sin carpeta de gobernanza GitHub |
| `.github/workflows/*` | **Ausente** | `actions/workflows` → `total_count: 0` |
| Issue templates | **Ausente** | |
| PR template | **Ausente** | |
| Branch protection / rulesets | **Ausente** | `main` no protegida; `rulesets: []` |
| Dependabot config en repo (YAML) | No inspeccionado como archivo; updates de seguridad de Dependabot **enabled** a nivel setting | No hay workflow CI propio |
| Secret scanning / push protection | **enabled** (settings) | Útil; no reemplaza `.gitignore` de `.env` |

### 5.2 Workspace local

En `c:\Users\Patricio\Desktop\TRES-CIELOS-SYS` tampoco hay (al inspeccionar) `.gitignore`, `LICENSE`, `.editorconfig`, `CODEOWNERS` ni `package.json` — coherente con “solo docs + PDF”, pero **ninguno** de esos archivos de gobernanza está versionado aún en GitHub.

### 5.3 Gobernanza mínima recomendada antes de aceptar contribuciones (**OBJETIVO**)

Sin inventar workflows concretos que no existen; lista de artefactos a crear:

1. `.gitignore` (Node, Next, Nest, Prisma, env, OS, IDE, coverage).
2. `README.md` de producto + enlace a `docs/`.
3. Publicar `docs/` al remoto (o monorepo completo).
4. Decidir LICENSE o cambiar visibilidad si el contenido es confidencial.
5. Proteger `main` (PRs + reviews; CI cuando exista).
6. Templates de PR / issue opcionales pero útiles.
7. `CODEOWNERS` cuando haya más de un maintainer.
8. `.editorconfig` + (al scaffold) ESLint/Prettier/engines en `package.json`.

---

## 6. Relación con el workspace local TRES-CIELOS-SYS

### 6.1 Dos realidades distintas

| Dimensión | Remoto GitHub | Workspace local |
|---|---|---|
| Path | Clone vacío (cualquier carpeta) | `c:\Users\Patricio\Desktop\TRES-CIELOS-SYS` |
| Git | Sí (`.git`, origin → GitHub) | **No** había `.git` en la inspección |
| Contenido | Solo `README.md` | `docs/**` rico + PDF comercial |
| Uso actual | Placeholder / nombre reservado | Fuente de verdad de **diseño y contratos** |

### 6.2 Implicaciones

1. **No confundir** “abrir el workspace de docs” con “haber clonado el remoto”. Hoy no son el mismo árbol.
2. Un `gh repo clone` **no** trae la documentación local; hay que **publicarla** (commit/push) o copiarla al clone.
3. Si se inicializa git en el workspace local y se apunta `origin` al remoto, el primer push debe incluir `.gitignore` adecuado (evitar `~$*.pdf` de Office, `.env`, secretos).
4. El PDF comercial en raíz es material de negocio; decidir si debe ir al repo **público** antes de pushearlo.

### 6.3 Flujos recomendados (sin ejecutar cambios destructivos)

**Opción A — Local es la fuente que alimentará el remoto**

1. En el workspace de docs: `git init` (o clonar remoto en otra carpeta y copiar `docs/`).
2. Añadir `.gitignore`, README real, `docs/`.
3. Commit y push a `main` (o branch + PR cuando haya protección).

**Opción B — Clonar remoto y migrar docs**

1. `gh repo clone PMedinaGarcia/tres-cielos-sys` a carpeta nueva.
2. Copiar `docs/` (y lo que se decida del PDF) desde el workspace Desktop.
3. Commit/push.

Hasta completar A o B, el remoto y el workspace **divergen**.

---

## 7. Checklist post-clone

Usar después de clonar `PMedinaGarcia/tres-cielos-sys`.

### 7.1 Verificación inmediata del remoto (hoy)

- [ ] `git remote -v` apunta a `PMedinaGarcia/tres-cielos-sys`
- [ ] Rama `main` y un solo commit `Initial commit`
- [ ] Solo existe `README.md` (título del repo)
- [ ] Confirmar que **no** esperabas código ni `docs/` todavía — es el estado real
- [ ] Si necesitás diseño/producto: obtener el workspace de docs local o esperar a que se publique en el remoto

### 7.2 Cuando el monorepo objetivo ya esté en el remoto

- [ ] Node.js LTS según `engines` / `.nvmrc`
- [ ] Gestor de paquetes del monorepo (preferencia documentada: pnpm) + lockfile
- [ ] Copiar `.env.example` → `.env` local (sin commitear)
- [ ] Levantar Postgres + pgvector (+ Redis si aplica) vía Compose/docs de infra
- [ ] Migraciones Prisma + seeds de roles
- [ ] Arrancar `apps/api` y `apps/web`; health/smoke según [../setup/02-backend-setup.md](../setup/02-backend-setup.md) y [../setup/01-frontend-setup.md](../setup/01-frontend-setup.md)
- [ ] Leer [../README.md](../README.md) y orden de lectura producto → database/backend → frontend → infra → setup

### 7.3 Seguridad post-clone

- [ ] No copiar secretos de Meta/Twilio/LLM/Cohere/SMTP al repo
- [ ] Verificar que `.env` está ignorado
- [ ] Si el repo sigue público: no subir PDF u otros materiales confidenciales sin decisión explícita

---

## 8. Criterios de éxito: repo listo para contribuir

Un contribuidor nuevo puede considerarse “desbloqueado” cuando se cumplen **todos** los siguientes. Hoy el remoto **no** los cumple.

### 8.1 Descubrimiento y contexto

| Criterio | Estado actual |
|---|---|
| Descripción GitHub no vacía + topics útiles | **No** |
| README explica producto, stack y estado | **No** (solo título) |
| `docs/` versionado y enlazado desde README | **No** en remoto (sí en workspace local) |
| Licencia o política de uso clara | **No** |

### 8.2 Ingeniería mínima

| Criterio | Estado actual |
|---|---|
| `.gitignore` adecuado al stack | **No** |
| Scaffold o al menos estructura `apps/` + `packages/shared` **o** fase document-only explícita en README | **No** (ni scaffold ni docs en remoto) |
| `.env.example` sin secretos | **No** |
| Instrucciones de setup ejecutables o honestamente marcadas como pre-scaffold | Solo en docs **locales** |

### 8.3 Colaboración GitHub

| Criterio | Estado actual |
|---|---|
| Branch protection o ruleset en `main` | **No** |
| Camino de contribución (fork+PR o branch+PR) documentado | **No** |
| CI básica (lint/test/build) cuando haya código | **No** (0 workflows) |
| CODEOWNERS o lista de maintainers | Solo owner implícito |

### 8.4 Definición corta de “listo”

> El clone da contexto de producto, reglas de contribución y (según fase) código o docs versionados suficientes para trabajar sin pedir el zip del workspace de otra persona.

**Verdict 2026-07-27:** el remoto es un **placeholder público**. No está listo para contribuir al producto; sí está listo para **reservar el nombre** y recibir el primer push real de docs/scaffold.

---

## 9. Gaps

Lista priorizada (impacto → contribución / riesgo).

| # | Gap | Impacto | Tipo |
|---|---|---|---|
| G1 | Remoto sin `docs/` ni código; divergencia total vs workspace local | Contribuidor ciego | Contenido |
| G2 | README vacío de producto | Onboarding nulo | Contenido |
| G3 | Sin `.gitignore` | Riesgo de commitear secretos/`node_modules` al primer scaffold | Gobernanza |
| G4 | Repo **público** sin LICENSE ni decisión de confidencialidad del PDF | Riesgo legal / de negocio | Gobernanza |
| G5 | `main` sin protección ni rulesets | Push directo, sin review | Gobernanza |
| G6 | Sin `.github/` (workflows, templates, CODEOWNERS) | Sin CI ni proceso de PR | Gobernanza / CI |
| G7 | Descripción, homepage y topics vacíos | Descubribilidad baja | Metadata |
| G8 | Workspace local sin `.git` ligado al remoto | Dos fuentes de verdad no sincronizadas | Proceso |
| G9 | Monorepo objetivo (`apps/*`, `packages/shared`, Compose, Prisma) inexistente en remoto | No hay entorno ejecutable vía clone | Scaffold |
| G10 | Sin collaborators adicionales documentados | Bus factor = 1 (`PMedinaGarcia`) | Equipo |
| G11 | CI/CD y IaC ausentes (esperado en fase temprana, pero gap vs setup infra) | No hay verificación automática | Infra |
| G12 | Docs de setup aún referencian `<URL_DEL_REPO>` genérico en sitios | Debe actualizarse a esta URL al publicar | Docs |

**No son gaps inventados de CI:** no se documentan jobs, matrices ni actions que no existan. El gap es precisamente la **ausencia** de workflows (`total_count: 0`).

---

## 10. Referencias cruzadas

| Documento | Relación |
|---|---|
| [../README.md](../README.md) | Índice de documentación de producto (local) |
| [../frontend/01-estructura.md](../frontend/01-estructura.md) | Monorepo objetivo `apps/` + `packages/shared` |
| [../setup/00-indice.md](../setup/00-indice.md) | Entrada a setup |
| [../setup/01-frontend-setup.md](../setup/01-frontend-setup.md) | Clonado genérico + estado “sin código” |
| [../setup/02-backend-setup.md](../setup/02-backend-setup.md) | Prerrequisitos API / Prisma / workers |
| [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) | Compose/CI/IaC como pendientes |
| [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) | Componentes lógicos y secretos |
| [../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md) | DoD de producto (distinto de “repo listo para contribuir”) |

---

## Apéndice A — Comandos de reinspección

Para revalidar el remoto sin asumir que este doc está fresco:

```bash
gh repo view PMedinaGarcia/tres-cielos-sys
gh api repos/PMedinaGarcia/tres-cielos-sys/contents/
gh api repos/PMedinaGarcia/tres-cielos-sys/actions/workflows
gh api repos/PMedinaGarcia/tres-cielos-sys/branches
gh api repos/PMedinaGarcia/tres-cielos-sys/rulesets
```

---

## Apéndice B — Resumen ejecutivo

| Pregunta | Respuesta (2026-07-27) |
|---|---|
| ¿Existe el repo remoto? | **Sí** — público, `main`, owner `PMedinaGarcia` |
| ¿Qué contiene? | Solo `README.md` mínimo |
| ¿Hay CI, LICENSE, CODEOWNERS, .gitignore? | **No** |
| ¿Dónde está la documentación profunda? | Workspace local `TRES-CIELOS-SYS/docs/` — **no** en GitHub aún |
| ¿Listo para contribuir al producto? | **No** — falta publicar docs/scaffold y gobernanza básica |
)
