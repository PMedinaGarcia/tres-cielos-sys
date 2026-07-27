# Frontend — autenticación y configuración

Contrato de **auth en cliente**, variables de entorno y **feature flags** del panel Next.js.

**Estado del repo:** sin app, sin middleware, sin `.env.example` de frontend. Contenido **propuesto**, alineado a [../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) §3.7 / §6 / §7, login DTO ([../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) §4.1) e [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md).

---

## 1. Modelo de sesión (propuesto)

### 1.1 Flujo login

```
Usuario → POST /auth/login { email, password }
  ← { accessToken, expiresIn, user }
  → Persistir sesión (cookie httpOnly preferida, o memoria + refresh)
  → AuthProvider hidrata user
  → Redirect a home por rol (asesor→bandeja/alertas; coord→carga; admin→carga/telemetría)
```

`GET /auth/me` al montar la app si hay cookie/sesión, para rehidratar sin confiar solo en JWT decodeado en cliente.

### 1.2 Claims espejo (`PanelAuthContext`)

El cliente **no** es fuente de verdad, pero puede cachear el mismo shape que backend §6:

```ts
type PanelAuthContext = {
  userId: string;
  email: string;
  name: string;
  role: 'asesor' | 'coordinador' | 'admin';
  sedeIds: string[];
  orgId: string;
  flags: { activo: boolean; disponible: boolean };
  sessionId?: string;
  iat?: number;
  exp?: number;
};
```

Mapeo desde `LoginResponse.user`:

| API `user` | Context |
|---|---|
| `id` | `userId` |
| `nombre` | `name` |
| `email` | `email` |
| `rol` | `role` |
| `sedeIds` | `sedeIds` |
| `disponible` / `activo` | `flags.*` |
| — | `orgId` (**gap**: no viene en LoginResponse actual; añadir al DTO o a `/me`) |

### 1.3 Almacenamiento de token

| Opción | Pros | Contras | Recomendación v1 |
|---|---|---|---|
| **Cookie httpOnly + Secure + SameSite** (API set-cookie o BFF Next) | Mitiga XSS robo de token | CSRF a considerar; SameSite=Lax suele bastar en same-site | **Preferida** |
| Bearer en memoria + refresh | No persiste en disco | Pierde sesión al F5 sin refresh cookie | Aceptable con refresh |
| `localStorage` accessToken | Simple | Vulnerable a XSS | **Evitar** |

Si el access token viaja en JS: vida corta (`expiresIn`, p. ej. 3600 s) + refresh.

### 1.4 Refresh

**Gap de contrato:** `05-dtos-y-tipos.md` no define `refreshToken` ni `POST /auth/refresh`.

Propuesta hasta fijar backend:

| Elemento | Propuesta |
|---|---|
| `refreshToken` | Cookie httpOnly rotativa **o** omitir y usar sesiones server-side |
| `POST /auth/refresh` | Renueva `accessToken`; 401 → login |
| Cambio de rol/sedes | Invalidar sesiones (backend); cliente fuerza re-login en próximo 401 |

Hasta existir endpoint: al expirar `accessToken`, `GET /auth/me` fallará → login.

### 1.5 Logout

Propuesto: `POST /auth/logout` (invalida refresh/sesión server) + clear client + redirect `/login`. Si no existe aún: clear client-only + documentar deuda.

### 1.6 Usuario inactivo

Aunque el JWT no haya expirado, API rechaza con 401 si `activo = false`. UI: mismo path que sesión inválida.

---

## 2. Middleware y gates de ruta (Next.js)

Espejo de AuthGuard / RolesGuard — **defense in depth**, no autoridad.

### 2.1 Middleware de sesión

- Rutas públicas: `/login`, assets, health.
- Resto: sin sesión → redirect `/login?next=…`.
- Con sesión: si path es `/login` → redirect home.

### 2.2 Route gates por rol

Alineado a [00-superficies.md](00-superficies.md) §4, [02-routing-y-paginas.md](02-routing-y-paginas.md) y guards §3.7:

| Prefijo ruta | Asesor | Coordinador | Admin |
|---|---|---|---|
| `/bandeja`, `/expedientes`, `/pipeline`, `/alertas` | Sí | Sí | Sí |
| `/asignacion` | No | Sí | Sí |
| `/cupo` | No | Sí | Sí |
| `/conocimiento`, `/catalogo` | No | Lectura limitada / No mutar | Sí |
| `/admin` | No | Lectura limitada | Sí |
| `/telemetria` | No | Limitado | Sí |

Implementación: layout server que lee rol de sesión + redirect 403 page, **y** menú que oculta entradas. Fetch siempre pasa por API.

### 2.3 Capability checks en UI

Botones (reasignar, publicar, drill-down telemetría) condicionados a `useCan()`. Un 403 residual muestra toast — no crash.

---

## 3. Variables de entorno (frontend)

Solo variables **seguras para el browser** con prefijo `NEXT_PUBLIC_`, más secretos solo server-side si hay BFF/Route Handlers.

### 3.1 Obligatorias / recomendadas

| Variable | Ámbito | Descripción |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | public | Base HTTPS del API Nest (ej. `https://api.staging…`) |
| `NEXT_PUBLIC_API_PREFIX` | public | Prefijo opcional (`""` o `/api/v1`) |
| `NEXT_PUBLIC_APP_ENV` | public | `development` \| `staging` \| `production` |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | public | `es-MX` |
| `NEXT_PUBLIC_SLA_ESCALACION_MIN` | public | `15` (UI reloj) |
| `NEXT_PUBLIC_SLA_ESCALACION_MAX` | public | `30` |
| `NEXT_PUBLIC_REALTIME_URL` | public | URL WS/SSE si aplica; vacío = polling |
| `NEXT_PUBLIC_FEATURE_DEVOLVER_BOT` | public | `false` en v1 (default producto) |
| `SESSION_SECRET` / JWT verify | **server only** | Solo si Next verifica JWT en middleware; preferible confiar en cookie de sesión emitida por API/BFF |
| `API_INTERNAL_URL` | server | URL interna si SSR llama al API sin pasar por edge público |

**Nunca** en frontend: `DATABASE_URL`, claves Meta/Twilio, `COHERE_API_KEY`, LLM keys (infra §4).

### 3.2 Por entorno

| Entorno | Notas |
|---|---|
| dev | API local; realtime opcional off |
| staging | UAT Tres Cielos; claves de prueba en backend |
| prod | Jardín 1; HTTPS; cookies Secure |

Alinear nombres con el gestor de secretos Medina; no commitear `.env`.

---

## 4. Feature flags (propuesto)

Flags de producto/técnicos para no acoplar UI a features incompletas. Fuente v1: env `NEXT_PUBLIC_FF_*` o objeto `features.ts` leído de env. Más adelante: remote config si hace falta.

| Flag | Default go-live | Efecto UI |
|---|---|---|
| `FF_DEVOLVER_A_BOT` | `false` | Oculta CTA; si se llama API → 409 |
| `FF_REALTIME` | `false` hasta canal listo | Si false → polling bandeja/alertas |
| `FF_MULTI_SEDE_UI` | `false` | Oculta selector de sede; una sede activa |
| `FF_REASIGNAR_ASESOR` | `false` | Asesor sin reasignar (salvo pacto kick-off) |
| `FF_TELEMETRIA_COORD` | `true` preferido | Coord ve resumen sede lectura |
| `FF_CONOCIMIENTO_BORRADOR_COORD` | `false` | Coord no edita borradores salvo pacto |
| `FF_ADMIN_API` | `false` hasta DTOs | Oculta mutaciones admin incompletas |
| `FF_CUPO_VISTA` | `false` hasta DTO cupo | Placeholder o hidden |
| `FF_PIPELINE_QUICK_STAGE` | opcional | Cambio etapa desde tarjeta |

Leer flags en `getFeatures(): Features`; no esparcir `process.env` en componentes.

---

## 5. Headers y CSRF

- Si cookie de sesión en mismo sitio: `credentials: 'include'` en fetch.
- Si Bearer: header `Authorization`; no hace falta CSRF para APIs token-only.
- Cookie mutante cross-site: añadir anti-CSRF (double submit o SameSite estricto).

---

## 6. Errores de auth en UI

| Situación | UI |
|---|---|
| Credenciales inválidas | Mensaje en form login (sin filtrar si email existe) |
| 401 en app | Modal/toast breve → login |
| 403 acción | Toast: mensaje producto backend |
| Sesión expirada mid-mutation | Re-login + no perder copy del draft en memoria si es posible (reintentar post-login es nice-to-have, no v1 obligatorio) |

---

## 7. Checklist de implementación frontend auth

- [ ] Página `/login` + `useLogin`
- [ ] Persistencia sesión (cookie httpOnly preferida)
- [ ] `AuthProvider` + `useMe` bootstrap
- [ ] Middleware gate + route gates por rol
- [ ] Menú filtrado por matriz superficies
- [ ] Manejo 401 global en `api.client`
- [ ] `.env.example` con variables §3 (sin secretos)
- [ ] Acordar con backend: refresh, logout, `orgId` en `/me`

---

## 8. Criterio de cierre

Quedan definidos flujo de login/sesión, claims, almacenamiento, gaps de refresh/logout, middleware/gates, env vars del panel y feature flags v1. **Implementado en código: 0 %.**
