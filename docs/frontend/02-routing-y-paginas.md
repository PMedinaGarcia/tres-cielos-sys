# Frontend — routing, páginas, layouts y gates

Mapa de rutas del panel Next.js (App Router), composición de layouts y **guards solo de UI/routing**. La autorización real vive en NestJS ([../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md)).

**Estado del repo:** no hay `app/`, `middleware.ts` ni páginas implementadas. Rutas y gates siguientes son el **contrato esperado**.

Referencias: [00-superficies.md](00-superficies.md), [01-estructura.md](01-estructura.md), [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md).

---

## 1. Principios de navegación

- **Una composición por rol** en el primer viewport tras login (asesor = atender; coord/admin = equilibrar / auditar).
- Menú lateral (o top en móvil) muestra **solo** ítems permitidos; rutas profundas siguen gated.
- Deep links a expediente/hilo respetan ownership: si el API responde 404/403, la UI muestra empty/forbidden de producto, no datos ajenos.
- Go-live: una sede activa; no saturar nav con selector multi-sede incompleto.
- Sin rutas de marketing, settings genéricos ni “explorar analytics”.

---

## 2. Grupos de layout

| Grupo | Path group | Shell | Quién entra |
|---|---|---|---|
| Auth | `app/(auth)` | Centrado, sin nav operativa | Anónimos / post-logout |
| Panel | `app/(panel)` | `AppShell` (nav + main) | Sesión válida + `activo` |
| Error | `app/forbidden`, `not-found` | Mínimo | Cualquiera |

```
(auth)/layout          → sin SideNav
(panel)/layout         → SideNav + TopBar + children
middleware             → sesión + allowlist de path por rol
```

---

## 3. Tabla de rutas ↔ superficies

| Ruta | Superficie ([00](00-superficies.md)) | Asesor | Coordinador | Admin | Notas de página |
|---|---|---|---|---|---|
| `/login` | — | público | público | público | Form login |
| `/` | Home | redirect | redirect | redirect | Ver §5 |
| `/alertas` | Centro de alertas | propias | sede | sede | Feed + CTA a hilo/expediente |
| `/bandeja` | Bandeja | propias | equipo | equipo | Lista; query `?c=` opcional |
| `/bandeja/[conversacionId]` | Bandeja (hilo) | asignados | sede | sede | Thread + brief lateral |
| `/expedientes/[oportunidadId]` | Expediente | asignados | sede | sede | Ficha + timeline + brief |
| `/pipeline` | Pipeline | asignados | sede | sede | Columnas/lista por etapa |
| `/asignacion` | Asignación y carga | **no** | sí | sí | Lista densa multi-asesor |
| `/conocimiento` | Conocimiento RAG | **no** | no* | sí | Biblioteca + jobs |
| `/catalogo` | Catálogo paquetes | **no** | lectura | sí | SKUs + import |
| `/cupo` | Uso y cupo | **no** | sí | sí | Consumo vs 1,000 |
| `/admin` | Administración ligera | **no** | lectura limitada | sí | Usuarios, sedes, criterios, enrutador |
| `/telemetria` | Telemetría operativa | **no** | lectura limitada* | sí | Resumen sede + drill-down |
| `/telemetria/hilos/[conversacionId]` | Drill-down hilo | **no** | según pacto | sí | Timeline `EventoOperativo` |

\* Coordinador: borradores de conocimiento solo si Tres Cielos lo pacta; telemetría de sede preferida en lectura para SLA (producto). Default de gate: **bloquear escritura** y rutas de publicación.

Subrutas de admin sugeridas (mismo gate `admin` / lectura coord):

| Ruta | Contenido |
|---|---|
| `/admin/usuarios` | Usuarios y roles |
| `/admin/sedes` | Activar/desactivar jardín |
| `/admin/criterios` | Campos obligatorios de calificación |
| `/admin/tipificaciones` | Motivos de perdido |
| `/admin/enrutador` | Parámetros documentados (sede → disponibilidad → round-robin) |

---

## 4. Layouts y composición por página clave

### 4.1 Shell del panel (`(panel)/layout`)

- **SideNav:** ítems filtrados por `canSeeNavItem(role)`.
- **TopBar:** identidad (nombre, rol), sede activa (texto, no selector complejo en go-live), logout; badge de alertas no leídas.
- **Main:** `children` a ancho completo operativo (sin cards decorativas de “welcome”).

### 4.2 Bandeja (asesor — F5)

Viewport único:

1. Columna lista de hilos (prioridad fija).
2. Panel del hilo (mensajes + CTA primaria).
3. Aside mínimo del brief (ocasión / fecha / aforo / paquete).

Sin stats de equipo ni telemetría de rutas del bot.

Coordinador/admin: mismos tres paneles + filtros de asesor / sin asignar.

### 4.3 Expediente

Layout de ficha: cabecera (identidad + etapa + asesor) → brief de cotización → campos editables → timeline. Acciones: guardar, cambiar etapa, tipificar perdido, ir al hilo.

### 4.4 Asignación / carga

Lista densa (tabla): asesor × métricas + cola sin dueño + regla vigente en lenguaje claro + acción Reasignar. Sin gráficos en v1.

### 4.5 Telemetría

Dos niveles: resumen sede → drill-down por hilo. Asesor no tiene ruta.

---

## 5. Redirect de home por rol

| Rol | Destino preferido post-login / `/` |
|---|---|
| `asesor` | `/alertas` si hay pendientes urgentes; si no `/bandeja` |
| `coordinador` | `/asignacion` |
| `admin` | `/asignacion` o `/telemetria` (preferencia: `/asignacion` en día a día; telemetría en menú) |

Implementación: Server Component lee `PanelAuthContext` y `redirect()`.

---

## 6. Gates de ruta (UI only)

Espejo de [../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) §3.7. **Defense in depth:** ocultar ≠ autorizar.

### 6.1 Capas

| Capa | Dónde | Equivalente API |
|---|---|---|
| Sesión | `middleware.ts` | `AuthGuard` |
| Rol → path | `middleware` + `lib/rbac` + nav | `RolesGuard` |
| Ownership visual | No fetch de recursos ajenos; manejar 404 | `OwnershipGuard` / predicados |
| Sede | No selector cross-sede; API filtra | `SedeScopeGuard` |

### 6.2 Allowlist por rol (paths de panel)

```ts
// Contrato conceptual — lib/rbac/routes.ts
const ROUTES_ASESOR = [
  "/alertas",
  "/bandeja",
  "/expedientes",
  "/pipeline",
];

const ROUTES_COORDINADOR = [
  ...ROUTES_ASESOR,
  "/asignacion",
  "/cupo",
  "/admin",       // solo lectura limitada en UI
  "/catalogo",    // solo lectura
  "/telemetria",  // lectura limitada según pacto
];

const ROUTES_ADMIN = [
  ...ROUTES_COORDINADOR,
  "/conocimiento",
  // admin escritura en /catalogo, /admin/*, /telemetria completo
];
```

Reglas:

- Prefijo match: `/bandeja/xyz` permitido si `/bandeja` está en la lista.
- Asesor que navega a `/asignacion` → redirect a `/` o página `403` de producto (“No tienes permiso para esta acción.”).
- Coordinador en `/conocimiento` publicación: ocultar CTAs; si se abre ruta de publish → 403 UI (API también 403).

### 6.3 Mapeo de errores HTTP → UI

| Código | Comportamiento UI |
|---|---|
| `401` | Limpiar sesión → `/login` |
| `403` | Toast/banner con mensaje de producto; no crash |
| `404` | Empty state de expediente/hilo (“No encontramos…”) |

---

## 7. Navegación conceptual (ítems de menú)

| Ítem | Asesor | Coordinador | Admin |
|---|---|---|---|
| Alertas | ✓ | ✓ | ✓ |
| Bandeja | ✓ | ✓ | ✓ |
| Pipeline | ✓ | ✓ | ✓ |
| Asignación y carga | — | ✓ | ✓ |
| Conocimiento | — | — | ✓ |
| Catálogo | — | ✓ (lectura) | ✓ |
| Cupo | — | ✓ | ✓ |
| Administración | — | ✓ (limitada) | ✓ |
| Telemetría | — | ✓ (limitada) | ✓ |

Expediente no es ítem de menú principal: se abre desde bandeja, pipeline o alertas.

---

## 8. Query params y deep links útiles

| Origen | Destino |
|---|---|
| Alerta | `/bandeja/[conversacionId]` o `/expedientes/[id]` |
| Reasignación | Mantener contexto: volver a `/asignacion` |
| Job de ingesta | `/conocimiento?doc=[id]` con panel de estado |
| SLA fuera de ventana | `/bandeja?urgencia=fuera_sla` (coord/admin; asesor solo propios) |

Params engañosos (`asesorId` de otro) en rol asesor: la UI no debe ofrecer el control; si se fuerza, el API ignora o 403 ([../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md) §5.2).

---

## 9. Criterios UAT ligados a routing (F1–F7)

| ID | Implicación de ruta/UI |
|---|---|
| F1 | Asesor A no puede abrir UI útil de hilos de B (404/empty) |
| F2 | Solo coord/admin entran a `/asignacion` |
| F3 | Tras calificar, hilo aparece en bandeja destino ≤ 5 s (refresh/realtime) |
| F4 | Badges SLA visibles en `/alertas` y `/bandeja` |
| F5 | Viewport `/bandeja` asesor cumple checklist de minimalismo |
| F6 | Tras reasignar, deep link origen pierde acceso; destino lo gana |
| F7 | `/telemetria` inaccesible a asesor |

Detalle: [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) §6.

---

## 10. Criterio de cierre de este entregable

Quedan definidas rutas ↔ superficies, layouts, redirect por rol, allowlist de gates UI, menú por perfil y mapeo de errores — sin sustituir los guards NestJS.
