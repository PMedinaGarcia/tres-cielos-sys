# Setup inicial — Frontend (panel Next.js)

Guía profunda para preparar el entorno de desarrollo del **panel operativo** Event Master / Tres Cielos (Next.js). Complementa el contrato de producto y arquitectura en [`docs/frontend/`](../frontend/).

| Campo | Valor |
|---|---|
| Estado del repo (2026-07-27) | **Sin código de aplicación frontend.** No existen `apps/`, `frontend/`, `package.json`, `next.config.*`, `.env.example` ni dependencias instalables. |
| Naturaleza de este doc | **Setup objetivo / contrato de ingeniería** derivado de la documentación de diseño. Al existir scaffold, el código gana y este archivo se alinea. |
| Stack de referencia | Next.js (App Router) + React + TypeScript + Tailwind + Zod (`packages/shared`) + TanStack Query |
| API consumida | NestJS (HTTPS, envelope `{ data }` / `{ error }`) |

**Lectura previa recomendada:** [00-superficies](../frontend/00-superficies.md) → [01-estructura](../frontend/01-estructura.md) → [06-auth-y-config](../frontend/06-auth-y-config.md) → [05-api-y-hooks](../frontend/05-api-y-hooks.md) → [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md).

---

## 1. Prerrequisitos

### 1.1 Estado actual vs objetivo

Hoy el workspace `TRES-CIELOS-SYS` contiene solo:

- `docs/` (producto, backend, frontend, database, infrastructure)
- PDF comercial `Propuesta_TresCielos_SistemaLeads_MedinaSystems_v1.5.pdf`

**No hay Node project.** Los pasos de instalación/arranque de las secciones 4–8 aplican **después** del scaffold (o en paralelo si se crea el monorepo en este repo). Hasta entonces, el “setup” válido es: clonar, leer docs, y preparar herramientas locales según la tabla siguiente.

### 1.2 Herramientas requeridas (objetivo)

| Herramienta | Versión | Notas |
|---|---|---|
| **Node.js** | **LTS activa** (recomendación: **20.x** o **22.x** LTS) | Exacta: **pendiente de fijar en `package.json` / `.nvmrc` al scaffold**. Evitar Node 18 si el equipo elige Next reciente que lo depreca. |
| **npm** / **pnpm** / **yarn** | El que fije el monorepo | Preferencia habitual en monorepos Next: **pnpm** + workspaces. **No hay lockfile aún** → no inventar gestor; al scaffold, documentar uno solo. |
| **Git** | 2.x | Clonado del repo |
| **Editor** | Cursor / VS Code | Extensiones útiles: ESLint, Tailwind CSS IntelliSense, Zod |
| **API NestJS local o staging** | — | El panel no arranca “solo”: necesita `NEXT_PUBLIC_API_URL` alcanzable ([§6](#6-integración-con-apibackend)) |
| **Navegador** | Chromium reciente | DevTools + Network para envelope y cookies |

Opcional:

| Herramienta | Uso |
|---|---|
| **nvm** / **fnm** / **volta** | Fijar Node cuando exista `.nvmrc` |
| **Docker** | Solo si el equipo corre Postgres/API vía compose (infra); el panel en sí suele correr en host |
| **curl** / **HTTPie** | Verificar `POST /auth/login` antes de depurar UI |

### 1.3 Qué no instalar en el frontend

Nunca en el entorno del panel (secretos de backend / infra):

- `DATABASE_URL`, claves Meta / Twilio, `COHERE_API_KEY`, API keys de LLM/embeddings, SMTP

Esos viven en el API y el gestor de secretos Medina ([infra §4](../infrastructure/01-stack-y-entornos.md)).

### 1.4 Cuentas y accesos de kick-off

Para un setup “útil” post-scaffold (no solo `npm run dev` en vacío):

- [ ] Credenciales de usuario panel por rol: `asesor`, `coordinador`, `admin` (seed en staging/dev)
- [ ] URL del API (dev local o staging)
- [ ] Confirmación del mecanismo de sesión: cookie httpOnly vs Bearer ([06-auth](../frontend/06-auth-y-config.md) §1.3)
- [ ] Acceso al repo y (si aplica) registry privado de paquetes — **hoy no hay**

---

## 2. Clonado y estructura de carpetas

### 2.1 Clonar

```bash
git clone <URL_DEL_REPO> TRES-CIELOS-SYS
cd TRES-CIELOS-SYS
```

Sustituir `<URL_DEL_REPO>` por el remoto real del equipo. En el workspace local actual la raíz es:

`c:\Users\Patricio\Desktop\TRES-CIELOS-SYS`

### 2.2 Estructura real hoy

```
TRES-CIELOS-SYS/
├── docs/
│   ├── README.md
│   ├── backend/
│   ├── database/
│   ├── frontend/          # Contrato UI (00–07)
│   ├── infrastructure/
│   ├── producto/
│   └── setup/
│       └── 01-frontend-setup.md   ← este archivo
└── Propuesta_TresCielos_SistemaLeads_MedinaSystems_v1.5.pdf
```

### 2.3 Estructura objetivo del frontend (monorepo)

Contrato fijado en [01-estructura.md](../frontend/01-estructura.md) §3–4:

```
TRES-CIELOS-SYS/
├── apps/
│   ├── api/                 # NestJS (fuera de este setup)
│   └── web/                 # Panel Next.js ← frontend
├── packages/
│   └── shared/              # Zod schemas, enums, PanelAuthContext
├── docs/
└── ...
```

Árbol interno objetivo de `apps/web/` (resumen):

```
apps/web/
├── app/                     # App Router: (auth), (panel), globals.css
├── components/
│   ├── ui/                  # Primitivos sin dominio CRM
│   ├── layout/              # AppShell, SideNav, RoleGate
│   └── {superficie}/        # bandeja, expediente, pipeline, …
├── lib/
│   ├── api/                 # Cliente HTTP + envelope
│   ├── auth/
│   ├── rbac/
│   └── format/
├── middleware.ts
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

**Alternativa aceptable en v1:** `frontend/` en la raíz con la misma organización interna; **no** microfrontends.

Detalle de rutas ↔ superficies: [02-routing-y-paginas.md](../frontend/02-routing-y-paginas.md).  
Detalle de capas de componentes: [03-componentes.md](../frontend/03-componentes.md).

### 2.4 Dónde vive el código compartido

| Paquete | Rol en setup |
|---|---|
| `packages/shared` | Enums + Zod alineados a [backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md); el panel **no** redefine `RolUsuario`, `EtapaPipeline`, etc. |
| `apps/web` | UI, hooks, cliente HTTP, middleware |

Ver [07-tipos.md](../frontend/07-tipos.md).

---

## 3. Variables de entorno

**Estado:** no existe `.env`, `.env.local` ni `.env.example` de frontend en el repo. La tabla siguiente es el **contrato propuesto** ([06-auth-y-config.md](../frontend/06-auth-y-config.md) §3, [01-estructura.md](../frontend/01-estructura.md) §6).

### 3.1 Variables del panel

| Variable | Ámbito | Obligatoria | Descripción | Ejemplo |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | public | **Sí** | Base HTTPS del API Nest **sin** trailing slash | `http://localhost:3001` |
| `NEXT_PUBLIC_API_PREFIX` | public | No | Prefijo de paths (`""` o `/api/v1`). Hoy los DTOs no fijan `/api/v1` — parametrizar | `""` |
| `NEXT_PUBLIC_APP_ENV` | public | Recomendada | `development` \| `staging` \| `production` (banners no productivos) | `development` |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | public | No | Locale UI | `es-MX` |
| `NEXT_PUBLIC_SLA_ESCALACION_MIN` | public | No | Minutos SLA “dentro de ventana” (UI reloj) | `15` |
| `NEXT_PUBLIC_SLA_ESCALACION_MAX` | public | No | Minutos SLA “fuera de ventana” | `30` |
| `NEXT_PUBLIC_REALTIME_URL` | public | No | WS/SSE; vacío = polling 2–3 s ([04-estado](../frontend/04-estado-y-datos.md) §5) | `` |
| `NEXT_PUBLIC_FEATURE_DEVOLVER_BOT` | public | No | CTA devolver a bot; default producto **false** | `false` |
| `API_INTERNAL_URL` | **server** | Condicional | URL interna para SSR/RSC sin edge público | `http://api:3001` |
| `SESSION_SECRET` | **server** | Condicional | Solo si Next verifica JWT/sesión en middleware; preferible confiar en cookie emitida por API/BFF | — |

Feature flags adicionales (vía `NEXT_PUBLIC_FF_*` o `features.ts`): ver [06-auth §4](../frontend/06-auth-y-config.md). Ejemplos: `FF_REALTIME`, `FF_MULTI_SEDE_UI`, `FF_CUPO_VISTA`, `FF_ADMIN_API`.

### 3.2 Plantilla `.env.example` (objetivo — crear al scaffold)

Archivo propuesto en `apps/web/.env.example` (o raíz del package web). **No commitear** `.env.local` con secretos.

```env
# --- Público (browser) ---
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_PREFIX=
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_DEFAULT_LOCALE=es-MX
NEXT_PUBLIC_SLA_ESCALACION_MIN=15
NEXT_PUBLIC_SLA_ESCALACION_MAX=30
NEXT_PUBLIC_REALTIME_URL=
NEXT_PUBLIC_FEATURE_DEVOLVER_BOT=false

# Feature flags (opcional; ver docs/frontend/06-auth-y-config.md §4)
NEXT_PUBLIC_FF_REALTIME=false
NEXT_PUBLIC_FF_MULTI_SEDE_UI=false
NEXT_PUBLIC_FF_REASIGNAR_ASESOR=false
NEXT_PUBLIC_FF_TELEMETRIA_COORD=true
NEXT_PUBLIC_FF_CONOCIMIENTO_BORRADOR_COORD=false
NEXT_PUBLIC_FF_ADMIN_API=false
NEXT_PUBLIC_FF_CUPO_VISTA=false

# --- Solo server (si aplica BFF / verificación de sesión en Next) ---
# API_INTERNAL_URL=http://localhost:3001
# SESSION_SECRET=
```

### 3.3 Por entorno

| Entorno | `NEXT_PUBLIC_APP_ENV` | API | Notas |
|---|---|---|---|
| **dev** | `development` | Local Nest | Realtime opcional off → polling |
| **staging** | `staging` | Staging Medina | UAT Tres Cielos; cookies Secure si HTTPS |
| **prod** | `production` | Prod Jardín 1 | HTTPS; una sede activa; sin banners de debug |

### 3.4 Reglas

- Solo variables seguras en browser con prefijo `NEXT_PUBLIC_*`.
- Nunca `DATABASE_URL` ni claves de canales/IA en el frontend.
- CORS / cookies SameSite: acordar con backend si el panel y el API están en orígenes distintos (dev típico: `localhost:3000` ↔ `localhost:3001`).

---

## 4. Instalación de dependencias y scripts

### 4.1 Estado actual

**No hay `package.json`.** Los scripts siguientes son el **contrato esperado** al scaffold; nombres exactos pueden variar (`turbo`, workspaces), pero el equipo debe exponer como mínimo: `dev`, `build`, `lint`, `test`, `preview`/`start`.

### 4.2 Instalación (post-scaffold)

Desde la raíz del monorepo (ejemplo con pnpm):

```bash
# Fijar Node LTS (cuando exista .nvmrc)
nvm use   # o fnm use / volta

# Instalar workspaces
pnpm install
# o: npm install / yarn install — según lockfile del scaffold
```

Solo el package web (si el monorepo lo permite):

```bash
pnpm --filter web install
# o: cd apps/web && pnpm install
```

Dependencias de referencia a incluir en el scaffold (no inventar versiones exactas aquí — **gap** hasta `package.json`):

| Área | Paquetes esperados |
|---|---|
| Framework | `next`, `react`, `react-dom` |
| Lenguaje | `typescript`, `@types/react`, `@types/node` |
| Estilos | `tailwindcss`, `postcss`, `autoprefixer` |
| Datos | `@tanstack/react-query` |
| Forms / validación | `zod`, `react-hook-form`, `@hookform/resolvers` |
| Shared | workspace `packages/shared` |
| Lint | `eslint`, `eslint-config-next` |
| Test | Vitest y/o Playwright (**por confirmar al scaffold**) |

### 4.3 Scripts objetivo (`apps/web/package.json`)

| Script | Comando típico | Propósito |
|---|---|---|
| `dev` | `next dev` | Servidor de desarrollo (puerto default **3000**) |
| `build` | `next build` | Build de producción |
| `start` | `next start` | Servir build (prod-like local) |
| `lint` | `next lint` / `eslint .` | Análisis estático |
| `typecheck` | `tsc --noEmit` | **Recomendado** aunque no esté en Next por defecto |
| `test` | `vitest` / `playwright test` | Unit / e2e — **pendiente de fijar** |
| `preview` | alias de `start` post-`build`, o Storybook si se añade | Preview de artefactos |

Desde raíz monorepo (ejemplo):

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web lint
pnpm --filter web test
```

### 4.4 Orden de bootstrap de ingeniería (vertical slice)

Cuando se cree el código, el orden mínimo útil es:

1. Scaffold Next App Router + Tailwind + TS estricto  
2. `packages/shared`: enums + `UserDto` / `LoginResponse` + envelope  
3. `lib/api/client` + `authApi.login` / `me`  
4. `/login` + `AuthProvider` + middleware de sesión  
5. Shell `(panel)` + redirect por rol + stub `/bandeja`  

Detalle: [05-api-y-hooks.md](../frontend/05-api-y-hooks.md) §8, [07-tipos.md](../frontend/07-tipos.md) §9.

---

## 5. Configuración de tooling

**Estado:** no hay `tsconfig.json`, `next.config.*`, ESLint ni Tailwind en el repo. Lo siguiente es el **objetivo** alineado a [01-estructura](../frontend/01-estructura.md) y [03-componentes](../frontend/03-componentes.md).

### 5.1 TypeScript

| Opción | Recomendación |
|---|---|
| `strict` | `true` |
| `paths` | Alias `@/*` → raíz de `apps/web` (p. ej. `@/components`, `@/lib`) |
| Shared | Import desde `@tres-cielos/shared` o path workspace equivalente |
| JSX | `preserve` (Next) |

Ejemplo conceptual de paths:

```json
{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"],
      "@tres-cielos/shared": ["../../packages/shared/src"]
    }
  }
}
```

(Ajustar al layout real del scaffold.)

### 5.2 Next.js (App Router)

| Archivo | Responsabilidad |
|---|---|
| `next.config.ts` | `transpilePackages: ['@tres-cielos/shared']` si aplica; sin exponer secretos |
| `middleware.ts` | Sesión + allowlist gruesa de rutas ([02-routing](../frontend/02-routing-y-paginas.md) §6) |
| `app/layout.tsx` | Tokens CSS, fuentes, providers mínimos |
| Route Handlers `app/api/*` | **Solo** si hay BFF/proxy; preferir llamar Nest directo ([01-estructura](../frontend/01-estructura.md) §4) |

Versiones exactas de Next/React/Tailwind: **gap** — fijar en scaffold y actualizar este doc + [01-estructura §2](../frontend/01-estructura.md).

### 5.3 ESLint

- Base: `eslint-config-next`
- Reglas de equipo: no `any` injustificado; imports de dominio solo desde features, no desde `components/ui`
- Script: `pnpm lint` / `npm run lint` debe pasar en CI cuando exista

### 5.4 Tailwind CSS

- Tokens operativos en `globals.css` (`--color-accent`, `--color-danger`, SLA, etc.) — [03-componentes §3](../frontend/03-componentes.md)
- Evitar look genérico SaaS púrpura / cream+terracotta / dark mode forzado
- Tipografías de marca Tres Cielos: **por confirmar** (gap de diseño)

### 5.5 Alias y frontera de módulos

| Importar | Desde |
|---|---|
| Primitivos UI | `@/components/ui` |
| Features de superficie | `@/components/bandeja`, etc. |
| HTTP | Solo `@/lib/api/*` conoce `NEXT_PUBLIC_API_URL` |
| RBAC UI | `@/lib/rbac` — **nunca** sustituye guards Nest ([06-guards](../backend/06-guards-y-rbac.md)) |
| Tipos wire | `@tres-cielos/shared` |

---

## 6. Integración con API/backend

### 6.1 Diagrama

```
Panel Next.js (apps/web)
    │  HTTPS / HTTP local
    │  Cookie httpOnly (preferida)  o  Authorization: Bearer
    ▼
API NestJS
    ├── Auth: POST /auth/login, GET /auth/me
    ├── CRM / bandeja / carga / notificaciones / telemetría
    └── (webhooks Meta/Twilio — NO llamados desde el panel)
```

Fuente de verdad de shapes: [backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md).  
Catálogo endpoint → UI: [05-api-y-hooks.md](../frontend/05-api-y-hooks.md) §2.  
RBAC: [backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md).

### 6.2 Base URL y prefijo

```ts
const base =
  process.env.NEXT_PUBLIC_API_URL!.replace(/\/$/, '') +
  (process.env.NEXT_PUBLIC_API_PREFIX ?? '');
// GET `${base}/conversaciones`
```

- Puerto del API en docs de ejemplo: **no fijado en infra**; convención local frecuente `3001` mientras Next usa `3000` — **confirmar en kick-off**.
- Prefijo `/api/v1`: **no adoptado aún en DTOs**; usar env.

### 6.3 Envelope

```ts
// Éxito
{ data: T }
// Lista
{ data: T[]; meta: { page; pageSize; total } }
// Error
{ error: { code: string; message: string; details?: unknown } }
```

Cliente: parsear, lanzar `ApiError`, en **401** limpiar sesión → `/login` (una vez). Ver [05-api-y-hooks §1](../frontend/05-api-y-hooks.md).

### 6.4 Auth

| Endpoint | Body / response | Uso setup |
|---|---|---|
| `POST /auth/login` | `{ email, password }` → `{ accessToken, expiresIn, user }` | Primer smoke test post-arranque |
| `GET /auth/me` | mismo `user` | Rehidratación de sesión |
| `POST /auth/logout` | — | **Propuesto**; gap en DTOs |
| `POST /auth/refresh` | — | **Gap** de contrato |

`user` incluye: `id`, `nombre`, `email`, `rol` (`asesor` \| `coordinador` \| `admin`), `sedeIds`, `disponible`, `activo`.  
`orgId` en `PanelAuthContext`: **gap** (añadir a `/me` o LoginResponse).

Fetch con cookies: `credentials: 'include'`. Bearer: header `Authorization`.

### 6.5 Proxies / CORS / BFF

| Opción | Cuándo |
|---|---|
| **Llamada directa** al Nest | Preferida; CORS permite origen del panel |
| **Rewrite en `next.config`** | Enmascarar origen en browser (`/backend/*` → API) |
| **Route Handlers BFF** | Solo si se necesita set-cookie same-origin o ocultar token |

No llamar webhooks Meta/Twilio desde el frontend.

### 6.6 Realtime

- Ideal: SSE/WS en `NEXT_PUBLIC_REALTIME_URL`
- Go-live pragmático: polling bandeja/alertas cada **2–3 s** con pestaña visible (criterio F3 ≤ 5 s) — [04-estado §5](../frontend/04-estado-y-datos.md)

---

## 7. Arranque local paso a paso

### 7.1 Hoy (solo documentación)

1. Clonar el repo.  
2. Leer este doc + `docs/frontend/00`–`07`.  
3. Verificar Node LTS instalado (`node -v`).  
4. **No** ejecutar `npm install` en la raíz: no hay manifiestos.  
5. Coordinar con el equipo la fecha/PR de scaffold `apps/web`.

### 7.2 Post-scaffold (checklist operativa de arranque)

Asumiendo monorepo con `apps/web` y API en `http://localhost:3001`:

```bash
# 1) Entrar al repo
cd TRES-CIELOS-SYS

# 2) Node
node -v    # LTS acordada
# nvm use  # si hay .nvmrc

# 3) Dependencias
pnpm install

# 4) Env del panel
cp apps/web/.env.example apps/web/.env.local
# Editar NEXT_PUBLIC_API_URL apuntando al Nest local/staging

# 5) Arrancar API (otro terminal; ver setup backend cuando exista)
# cd apps/api && pnpm start:dev

# 6) Arrancar panel
pnpm --filter web dev
# Abrir http://localhost:3000
```

### 7.3 Primer login

1. Abrir `/login`.  
2. Usar usuario seed `asesor` / `coordinador` / `admin`.  
3. Verificar redirect por rol ([02-routing §5](../frontend/02-routing-y-paginas.md)):
   - asesor → `/alertas` o `/bandeja`
   - coordinador → `/asignacion`
   - admin → `/asignacion` (telemetría en menú)
4. Confirmar en Network: `POST /auth/login` 200 + envelope; luego `GET /auth/me` o cookie de sesión.

### 7.4 Modo sin API (limitado)

Solo útil para UI estática/Storybook. **No** cumple criterios de éxito del setup (§10): el panel es inútil sin Nest para bandeja/RBAC.

---

## 8. Verificación post-setup (checklist operativa)

Marcar solo lo aplicable al estado del repo.

### 8.1 Pre-scaffold (documentación lista)

- [x] Repo clonado y `docs/frontend/*` accesibles  
- [x] Stack y árbol objetivo entendidos ([01-estructura](../frontend/01-estructura.md))  
- [x] Variables de entorno contractuales conocidas ([06-auth](../frontend/06-auth-y-config.md))  
- [ ] Node LTS instalado en la máquina del desarrollador  
- [ ] Acceso a API staging o plan de API local  

### 8.2 Post-scaffold (entorno de desarrollo listo)

- [ ] Existen `apps/web/package.json` (o `frontend/package.json`) y lockfile  
- [ ] `pnpm install` / `npm install` completa sin errores  
- [ ] `.env.example` presente; `.env.local` creado (no versionado)  
- [ ] `pnpm dev` sirve el panel en el puerto documentado  
- [ ] `pnpm lint` y `pnpm typecheck` (o equivalentes) pasan en limpio  
- [ ] `pnpm build` completa  
- [ ] Login contra API real/staging funciona  
- [ ] Middleware redirige anónimos a `/login`  
- [ ] Usuario asesor **no** ve nav de `/asignacion` ni `/telemetria` (UI gate)  
- [ ] `GET /conversaciones` (o stub) responde envelope parseable por el cliente  
- [ ] Alias `@/` y package `shared` resuelven en el IDE  

### 8.3 Smoke por rol (cuando haya seeds)

| Rol | Verificar |
|---|---|
| Asesor | Bandeja “solo míos”; sin montar `useCarga`; sin telemetría |
| Coordinador | `/asignacion` carga; alertas de sede; catálogo lectura |
| Admin | Conocimiento / catálogo mutaciones; telemetría sede |

UAT F1–F7: [producto/04-escenarios §6](../producto/04-escenarios-rol-carga-telemetria.md), [02-routing §9](../frontend/02-routing-y-paginas.md).

---

## 9. Problemas comunes y troubleshooting

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| No hay `package.json` / `npm install` falla | Scaffold aún no existe | Trabajar contra docs; no inventar app ad hoc fuera del contrato |
| `NEXT_PUBLIC_API_URL` undefined en browser | `.env.local` ausente o var sin prefijo `NEXT_PUBLIC_` | Copiar `.env.example`; reiniciar `next dev` (Next solo lee env al arrancar) |
| CORS en login | API no permite origen del panel | Configurar CORS Nest para `http://localhost:3000`; o rewrite/BFF |
| 401 inmediato tras login | Token no enviado (cookie vs Bearer inconsistente) | Alinear `credentials: 'include'` o header; revisar SameSite |
| Cookie no se setea en localhost cross-port | SameSite / Secure / dominio | Preferir BFF same-origin o Bearer en memoria + refresh acordado |
| 403 en rutas de coord siendo asesor | Esperado (RBAC) | Usar usuario correcto; UI debe redirect/toast, no crash |
| Bandeja vacía siempre | API sin seeds / filtros incorrectos / asesor sin asignaciones | Verificar seeds; no filtrar “ajeno” en cliente (F1) |
| Loop redirect `/login` | Handler 401 global + página login también llama `/me` | Excluir rutas públicas del redirect; no invalidar en loop |
| Tipos desalineados (`listo_para_cotizar` vs `listoParaCotizar`) | Confundir nombre de dominio con JSON API | Wire format = **camelCase** ([07-tipos §5](../frontend/07-tipos.md)) |
| Feature cupo / admin CRUD rota | DTO/path aún gap | Flags `FF_CUPO_VISTA` / `FF_ADMIN_API` en false hasta contrato |
| Realtime “no llega” en ≤ 5 s | Sin WS y polling lento/pausado | Activar polling 2–3 s en pestaña visible |
| `devolver-a-bot` 409 | Default producto v1 | Ocultar CTA (`FF_DEVOLVER_A_BOT=false`) |

---

## 10. Criterios de éxito del setup frontend

El entorno de desarrollo del panel se considera **listo** cuando se cumplen **todos** los criterios de la columna aplicable.

### 10.A — Fase documentación (estado actual del repo)

| # | Criterio | Cumple hoy |
|---|---|---|
| D1 | Contrato de superficies, estructura, routing, API, auth y tipos publicado bajo `docs/frontend/` | Sí |
| D2 | Variables de entorno y plantilla `.env.example` **documentadas** (aunque el archivo aún no exista en árbol de app) | Sí (este doc §3) |
| D3 | Gaps explícitos (sin código, sin versiones pinneadas, sin refresh/logout/cupo) | Sí (§11 gaps) |
| D4 | Código `apps/web` ejecutable | **No** — pendiente scaffold |

### 10.B — Fase entorno local ejecutable (objetivo post-scaffold)

| # | Criterio | Evidencia |
|---|---|---|
| E1 | Install reproducible con lockfile | `pnpm install` limpio en máquina nueva |
| E2 | Dev server estable | `dev` en `:3000` (o puerto doc) sin crash de boot |
| E3 | Build verde | `build` exit 0 |
| E4 | Lint/typecheck verdes | CI o local |
| E5 | Auth end-to-end contra API | Login → sesión → `/me` → home por rol |
| E6 | Cliente HTTP envelope | Parsea `{ data }` / `{ error }`; 401 → login |
| E7 | Gates UI mínimos | Asesor bloqueado de `/asignacion` y `/telemetria` |
| E8 | Shared types | Al menos enums + `UserDto` + un DTO de bandeja en `packages/shared` |
| E9 | Env documentado en repo | `.env.example` versionado sin secretos |

### 10.C — Listo para UAT de panel (más allá del setup puro)

Bandeja, expediente/brief, alertas, carga (coord), publicación conocimiento/catálogo (admin) según fases de go-live ([producto/02-fases-golive.md](../producto/02-fases-golive.md)). No se exige para declarar “setup FE OK”, pero sí para Etapa 7–8.

---

## 11. Gaps del repositorio (inventario)

| Gap | Impacto en setup | Fuente |
|---|---|---|
| Sin `apps/web`, `package.json`, lockfile, Docker compose FE | No se puede instalar ni arrancar panel | Exploración repo 2026-07-27 |
| Sin versiones pinneadas Next/React/Tailwind/Node | Prerrequisitos solo orientativos | [01-estructura §2](../frontend/01-estructura.md) |
| Sin `.env.example` real en árbol de app | Solo plantilla en este doc | [06-auth §3](../frontend/06-auth-y-config.md) |
| Sin `POST /auth/logout` ni refresh en DTOs | Sesión incompleta hasta kick-off | [05-dtos §4.1](../backend/05-dtos-y-tipos.md), [06-auth §1.4–1.5](../frontend/06-auth-y-config.md) |
| `orgId` ausente en LoginResponse | Context incompleto | [06-auth §1.2](../frontend/06-auth-y-config.md) |
| Prefijo `/api/v1` no fijado | Env `NEXT_PUBLIC_API_PREFIX` | [05-api §7](../frontend/05-api-y-hooks.md) |
| DTO HTTP cupo/uso ausente | Superficie cupo con flag off | [05-api §7](../frontend/05-api-y-hooks.md) |
| Admin usuarios/sedes/enrutador sin paths detallados | Feature flag `FF_ADMIN_API` | [05-api §2.2](../frontend/05-api-y-hooks.md) |
| Canal realtime no especificado en infra | Polling fallback | [04-estado §5](../frontend/04-estado-y-datos.md) |
| Tipografías / kit de marca Tres Cielos | Tokens CSS parciales | [03-componentes §3](../frontend/03-componentes.md) |
| Sin setup doc paralelo de backend en este entregable | Arranque local API referenciado pero no detallado aquí | — |

---

## 12. Referencias cruzadas

### Frontend

| Doc | Uso en setup |
|---|---|
| [00-superficies.md](../frontend/00-superficies.md) | Qué pantallas deben cargar tras login; matriz por rol |
| [01-estructura.md](../frontend/01-estructura.md) | Monorepo, árbol `apps/web`, stack, entrypoints |
| [02-routing-y-paginas.md](../frontend/02-routing-y-paginas.md) | Rutas, middleware, redirects, gates |
| [03-componentes.md](../frontend/03-componentes.md) | Capas UI, tokens, Tailwind |
| [04-estado-y-datos.md](../frontend/04-estado-y-datos.md) | React Query, polling/realtime, AuthProvider |
| [05-api-y-hooks.md](../frontend/05-api-y-hooks.md) | Cliente HTTP, endpoints, hooks |
| [06-auth-y-config.md](../frontend/06-auth-y-config.md) | Sesión, env, feature flags |
| [07-tipos.md](../frontend/07-tipos.md) | Zod/shared, alineación DTOs |

### Backend / infra / producto

| Doc | Uso |
|---|---|
| [backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) | Envelope, LoginResponse, shapes de bandeja/CRM |
| [backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) | Autoridad real; espejo UI |
| [infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) | Entornos dev/staging/prod, secretos |
| [producto/02-fases-golive.md](../producto/02-fases-golive.md) | Cuándo el panel entra a UAT/capacitación |
| [producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) | F1–F7 smoke de roles |

### Índice general

[docs/README.md](../README.md)

---

## 13. Criterio de cierre de este entregable

Queda documentado el setup profundo del frontend: prerrequisitos, clonado, estructura real vs objetivo, env + plantilla `.env.example`, scripts, tooling, integración API, arranque, verificación, troubleshooting, criterios de éxito y gaps — **sin fingir código inexistente**. Próximo paso de engineering: scaffold `apps/web` + `packages/shared` y actualizar este archivo con versiones pinneadas y comandos verificados.
