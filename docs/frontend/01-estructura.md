# Frontend — estructura, stack y entrypoints

Arquitectura de carpetas y stack del **panel operativo** Event Master / Tres Cielos (Next.js). Complementa el mapa de pantallas en [00-superficies.md](00-superficies.md).

**Estado del repo (2026-07-27):** no existe código de aplicación frontend (`apps/`, `frontend/`, `package.json`, `next.config.*`). Este documento fija la **estructura objetivo** alineada a backend, DTOs compartidos e infraestructura. Al implementar, el código gana y este doc se alinea.

Referencias:

- [00-superficies.md](00-superficies.md) — qué pantallas existen y quién las ve
- [02-routing-y-paginas.md](02-routing-y-paginas.md) — rutas, layouts, gates de rol
- [03-componentes.md](03-componentes.md) — composición UI y tokens
- [04-estado-y-datos.md](04-estado-y-datos.md) — caché, contextos, flujos de datos
- [05-api-y-hooks.md](05-api-y-hooks.md) — cliente HTTP y hooks
- [06-auth-y-config.md](06-auth-y-config.md) — sesión, env, feature flags
- [07-tipos.md](07-tipos.md) — Zod/shared alineado a DTOs
- [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) — wire format + Zod compartido
- [../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) — espejo Auth/Roles en UI
- [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) — panel Next.js ↔ API NestJS

---

## 1. Rol del frontend en el sistema

El panel es la superficie de trabajo del equipo comercial y de operación. **No** es sitio de marketing ni BI ejecutivo.

```
Meta / Twilio ──webhooks──► API NestJS ──► PostgreSQL
                               ▲
Panel Next.js ──HTTPS (sesión/JWT)──┘
```

Responsabilidades del frontend:

- Autenticar operadores y aplicar **gates de ruta / menú** por rol (espejo de RBAC; la API es autoridad).
- Renderizar las 10 superficies operativas ([00-superficies.md](00-superficies.md)).
- Consumir DTOs del envelope `{ data }` / `{ error }` ([../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) §1.3).
- Priorizar “qué hacer ahora” (escalaciones, listos para cotizar, calificados sin contactar).

Fuera de alcance v1 del panel: widget web público, app móvil nativa, PWA de marketing, dark mode como producto, multi-idioma.

---

## 2. Stack de referencia

| Capa | Elección | Notas |
|---|---|---|
| Framework | **Next.js** (App Router) | Alineado a docs de producto/infra |
| UI | **React** + TypeScript estricto | Misma familia de types que DTOs |
| Estilos | **Tailwind CSS** + tokens CSS propios | Design system operativo (§3 de [03-componentes.md](03-componentes.md)); no tema marketing |
| Componentes base | Primitivos propios o librería headless (p. ej. Radix) | Evitar kits “dashboard SaaS” genéricos sin adaptar |
| Validación cliente | **Zod** (espejo de enums/payloads) | Preferible en `packages/shared` |
| Datos servidor | Server Components + fetch a NestJS; Client Components donde haya interactividad (bandeja, chat) | Sin acoplar a un ORM en el browser |
| Auth sesión | Cookie httpOnly o Bearer según infra | Shape: `PanelAuthContext` ([../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) §6) |
| Tiempo real (recomendado) | SSE o WebSocket vía API, o polling corto en bandeja/alertas | Criterio F3: aparición ≤ 5 s post-calificación |

Versiones exactas de Next/React/Tailwind: **por confirmar al scaffold** (gap).

---

## 3. Monorepo propuesto

Hasta que exista scaffold, se asume monorepo con apps y paquete compartido (mencionado en DTOs):

```
TRES-CIELOS-SYS/
├── apps/
│   ├── api/                 # NestJS (fuera de este doc)
│   └── web/                 # Panel Next.js ← este frontend
├── packages/
│   └── shared/              # Zod schemas, enums, types PanelAuthContext
├── docs/
└── ...
```

Alternativa aceptable en v1: repo con `apps/web` únicamente y `packages/shared` mínimo. **No** inventar microfrontends.

Si el scaffold elige `frontend/` en la raíz en lugar de `apps/web/`, mantener la misma organización interna de carpetas (§4).

---

## 4. Árbol interno de `apps/web` (objetivo)

```
apps/web/
├── app/                          # App Router (entrypoints de ruta)
│   ├── layout.tsx                # Root: fuentes, tokens, providers
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx            # Layout sin shell operativo
│   ├── (panel)/
│   │   ├── layout.tsx            # Shell: nav + área de trabajo
│   │   ├── page.tsx              # Redirect por rol (home)
│   │   ├── bandeja/
│   │   ├── expedientes/
│   │   ├── pipeline/
│   │   ├── asignacion/
│   │   ├── alertas/
│   │   ├── admin/
│   │   ├── conocimiento/
│   │   ├── catalogo/
│   │   ├── cupo/
│   │   └── telemetria/
│   ├── api/                      # Solo BFF/proxy si se usa; preferir llamar NestJS directo
│   └── globals.css               # Tokens + reset
├── components/
│   ├── ui/                       # Primitivos (Button, Input, Badge, Table…)
│   ├── layout/                   # AppShell, SideNav, TopBar, RoleGate
│   ├── bandeja/                  # ThreadList, ThreadView, BriefAside…
│   ├── expediente/
│   ├── pipeline/
│   ├── asignacion/
│   ├── alertas/
│   ├── conocimiento/
│   ├── catalogo/
│   ├── cupo/
│   └── telemetria/
├── lib/
│   ├── api/                      # Cliente HTTP, envelope, errores 401/403/404
│   ├── auth/                     # Sesión, claims, helpers de rol
│   ├── rbac/                     # canAccessRoute, canSeeNavItem
│   └── format/                   # Fechas, moneda MXN, SLA clocks
├── middleware.ts                 # Sesión + gate grueso de rutas
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

Reglas:

- Una carpeta de features por superficie; no mezclar lógica de bandeja dentro de `ui/`.
- `components/ui` = sin conocimiento de dominio CRM.
- `lib/rbac` solo decide visibilidad; **nunca** sustituye predicados del API (F1).

---

## 5. Entrypoints

| Entrypoint | Responsabilidad |
|---|---|
| `app/layout.tsx` | HTML root, carga de tokens/fuentes, providers de sesión mínimos |
| `app/(auth)/login/page.tsx` | Login de operadores |
| `app/(panel)/layout.tsx` | Shell autenticado (nav según rol) |
| `app/(panel)/page.tsx` | Home: redirect (asesor → `/bandeja` o `/alertas`; coord/admin → `/asignacion` o `/alertas`) |
| `middleware.ts` | Sin sesión → `/login`; rutas restringidas → 403 page o redirect home |
| `lib/api/*` | Único lugar que conoce `NEXT_PUBLIC_API_URL` / URL interna |

No hay entrypoint de marketing (`/`, landing) en v1: la raíz del panel autenticado es operativa.

---

## 6. Variables de entorno (conceptuales)

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL pública del API NestJS (o URL del BFF) |
| Secretos de sesión / cookies | Solo server; no exponer en `NEXT_PUBLIC_*` |
| Flags de entorno | `dev` / `staging` / `prod` para banners no productivos |

Alineado a [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) §4–5.

---

## 7. Relación con otros paquetes

| Paquete / sistema | Contrato con el panel |
|---|---|
| `packages/shared` | Enums (`RolUsuario`, `EtapaPipeline`, …), schemas Zod, `PanelAuthContext` |
| API NestJS | Fuente de verdad de datos y autorización |
| Worker de ingesta | El panel solo muestra estado de job (`en_cola` / `indexando` / `listo` / `error`); no ejecuta embeddings |
| Canales Meta/Twilio | Invisible al panel salvo badges de canal en hilos |

---

## 8. Criterio de cierre de este entregable

Quedan fijados el rol del panel, el stack de referencia, el monorepo propuesto, el árbol interno, los entrypoints y las variables conceptuales — listos para scaffold sin inventar pantallas fuera de [00-superficies.md](00-superficies.md).
