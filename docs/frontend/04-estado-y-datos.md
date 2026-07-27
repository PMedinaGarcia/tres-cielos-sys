# Frontend — estado global y flujos de datos

Contrato de **estado, caché y flujos de datos** del panel Next.js (Event Master / Tres Cielos).

**Estado del repo:** no existe aplicación Next.js, ni stores, ni librerías de datos en código. Este documento es el **contrato propuesto** alineado a superficies ([00-superficies.md](00-superficies.md)), DTOs ([../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md)) y RBAC ([../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md)). Al implementar, el código gana y este doc se alinea.

Leyenda: **Propuesto** = diseño a implementar · **Implementado** = presente en el repo (hoy: nada de app).

---

## 1. Principios

1. **Una sola verdad en servidor:** el panel no inventa calificación, brief ni precios; solo refleja y muta vía API.
2. **Caché de servidor ≠ estado de dominio:** React Query (o equivalente) cachea DTOs; no duplicar modelos de negocio en Zustand “como CRM offline”.
3. **Estado global mínimo:** sesión/auth + preferencias UI + selección de hilo/expediente. El resto son queries/mutations.
4. **Scope en API, no en cliente:** el asesor no filtra “solo míos” en memoria; la bandeja ya viene filtrada (F1).
5. **Frescura operativa:** aparición de lead calificado / alerta ≤ **5 s** (F3) vía realtime o polling corto, sin recarga destructiva de la UI.

---

## 2. Stack de estado (propuesto)

| Capa | Librería / mecanismo | Responsabilidad |
|---|---|---|
| Datos remotos | **TanStack Query (React Query) v5** | Listados, detalle, invalidación, retries, staleTime |
| Sesión / identidad | **React Context** (`AuthProvider`) + cookie/token | `user`, claims espejo de `PanelAuthContext`, login/logout |
| Realtime (F3) | **SSE o WebSocket** hacia API NestJS, o polling 2–3 s en bandeja/alertas | Eventos `lead_calificado`, `escalacion`, `asignacion`, mensaje nuevo |
| UI local | `useState` / URL search params | Filtros de bandeja, panel abierto, draft de mensaje |
| Forms | React Hook Form + Zod | Expediente, login, import catálogo |
| Store global pesado | **No** en v1 | Evitar Zustand/Redux salvo necesidad demostrada (p. ej. draft multi-tab) |

App Router de Next.js: Server Components pueden hidratar datos iniciales de lectura; mutaciones y suscripciones viven en Client Components con el mismo QueryClient.

---

## 3. Query keys canónicos (propuesto)

Prefijo estable por dominio; incluir `sedeId` / `userId` cuando el cache deba aislarse por sesión:

```ts
['auth', 'me']
['conversaciones', 'list', query: ConversacionListQuery]
['conversaciones', 'detail', conversacionId]
['conversaciones', 'resumen-propio']
['oportunidades', 'detail', oportunidadId]
['oportunidades', 'brief', oportunidadId]
['oportunidades', 'pipeline', query]
['carga', sedeId]
['notificaciones', 'list', query]
['telemetria', 'hilo', conversacionId]
['telemetria', 'sede', sedeId, periodo]
['catalogo', 'paquetes', query]
['catalogo', 'paquete', paqueteId]
['conocimiento', 'documentos', query]
['conocimiento', 'documento', documentoId]
['cupo', 'periodo', sedeId?]          // endpoint backend aún por confirmar
['usuarios', 'list']                  // admin
```

Reglas:

- Tras mutación exitosa: invalidar keys afectadas (no “refetch todo”).
- Tras reasignación: invalidar bandeja origen implícita (API ya no devolverá el hilo) + `carga` + detalle oportunidad.
- No cachear indefinidamente notificaciones ni bandeja (`staleTime` corto: 5–15 s; realtime invalida de inmediato).

---

## 4. Contextos y estado de UI

### 4.1 `AuthProvider` (global)

| Campo | Origen | Notas |
|---|---|---|
| `user` | `LoginResponse.user` / `GET /auth/me` | `id`, `nombre`, `email`, `rol`, `sedeIds`, `disponible`, `activo` |
| `status` | `'anonymous' \| 'loading' \| 'authenticated'` | |
| `capabilities` | Derivado de `rol` + matriz superficies | Solo para **ocultar** UI; API sigue autorizando |

Ver [06-auth-y-config.md](06-auth-y-config.md).

### 4.2 Selección operativa (layout bandeja / expediente)

Estado de ruta preferido (deep-linkable):

| Estado | Dónde | Ejemplo |
|---|---|---|
| Hilo activo | `/bandeja?c=` o `/bandeja/[conversacionId]` ([02-routing](02-routing-y-paginas.md)) | Abre panel de mensajes |
| Expediente | `/expedientes/[oportunidadId]` | |
| Filtros bandeja | search params | `estadoBot`, `urgenciaSla`, `asesorId` (solo coord/admin) |

No persistir drafts de mensaje en localStorage en v1 (riesgo PII); draft solo en memoria del panel.

### 4.3 Preferencias ligeras (opcional)

Tema, densidad de cola, última sede seleccionada (si multi-sede): `localStorage` sin secretos.

---

## 5. Realtime e invalidación (F3)

### 5.1 Eventos de panel (propuesto)

Payload mínimo hacia el cliente (no confundir con `EventoOperativo` completo):

```ts
type PanelRealtimeEvent =
  | { type: 'bandeja.updated'; conversacionId: string; oportunidadId: string }
  | { type: 'mensaje.created'; conversacionId: string; mensajeId: string }
  | { type: 'notificacion.created'; notificacionId: string; tipo: TipoNotificacion }
  | { type: 'asignacion.changed'; oportunidadId: string }
  | { type: 'conocimiento.job'; documentoId: string; estado: string }
  | { type: 'oportunidad.updated'; oportunidadId: string };
```

Al recibir: `queryClient.invalidateQueries` de las keys correspondientes.

### 5.2 Fallback sin websocket

Si no hay canal realtime en go-live: polling de `GET /conversaciones` + `GET /notificaciones` cada **2–3 s** mientras la pestaña esté visible (`document.visibilityState`), pausar en background. Cumple F3 de forma pragmática.

---

## 6. Flujos de datos clave

### 6.1 Lead calificado → bandeja del asesor

```
Bot califica (backend)
  → Asignación automática + Notificacion tipocalificado
  → Realtime / poll
  → Invalidar ['conversaciones','list'] + ['notificaciones','list']
  → BandejaItem aparece con prioridad (escalación > listo > calificado sin contactar)
```

UI asesor: no pide `asesorId`; el API ya scopea. Ver DTO §3.6 y dominio CRM.

### 6.2 Escalación → toma de control → mensaje humano

```
estadoBot = escalado + Notificacion escalacion + urgenciaSla
  → Asesor: POST /conversaciones/:id/tomar-control
  → Invalidar detail + list
  → POST /conversaciones/:id/mensajes { contenido }
  → Puede emitir primer_mensaje_post_escalacion (SLA)
  → POST /notificaciones/:id/atender
```

Estado local: draft del textarea; al éxito, limpiar draft e invalidar mensajes del detail.

### 6.3 Expediente / brief / listo_para_cotizar

```
GET /oportunidades/:id (+ brief embebido o GET .../brief)
  → Form expediente (Zod = ActualizarOportunidadRequest)
  → PATCH /oportunidades/:id
  → Backend recalcula calificacion / listoParaCotizar
  → Invalidar detail, brief, pipeline, bandeja (badges)
```

Aviso UI si `brief.precioCatalogoDesactualizado === true` (catálogo publicado después del snapshot).

### 6.4 Coordinador — carga y reasignación

```
GET /carga → asesores[] + colaSinAsignar
  → POST /asignaciones { oportunidadId, usuarioDestinoId }
  → Invalidar carga, bandejas (ambos scopes vía refetch), oportunidad, notificaciones
```

Asesor **nunca** monta query `['carga']` (route gate + 403 API).

### 6.5 Admin — conocimiento / catálogo

```
Publicar documento → jobIngesta en DocumentoFuenteDto
  → Poll o realtime conocimiento.job hasta listo|error (< 60 s)
Publicar paquete/precio → briefs abiertos pueden marcar precio desactualizado
  → Invalidar catálogo + briefs abiertos en UI si el usuario los tiene montados
```

### 6.6 Pipeline

```
GET /oportunidades?vista=pipeline → tarjetas por etapa
  → PATCH etapa desde tarjeta o expediente
  → Invalidar pipeline + detail + bandeja
```

Asesor: solo asignados (API). Coord/admin: sede.

---

## 7. Mapeo superficie → fuentes de datos

| Superficie | Queries principales | Mutations |
|---|---|---|
| Bandeja | `conversaciones/list`, `detail`, `resumen-propio` | mensaje, tomar-control, devolver-a-bot |
| Expediente | `oportunidades/detail`, `brief` | `PATCH oportunidades` |
| Pipeline | `oportunidades/pipeline` | cambio etapa (mismo PATCH) |
| Asignación/carga | `carga` | `POST asignaciones`, `PATCH disponibilidad` |
| Alertas | `notificaciones/list` | leer, atender |
| Admin | `usuarios`, sedes, reglas (DTOs admin por confirmar) | CRUD admin |
| Conocimiento | `conocimiento/documentos` | crear, publicar, archivar |
| Catálogo | `catalogo/paquetes` | CRUD, import, publicar |
| Cupo | `cupo` (**gap** de path DTO) | — (lectura) |
| Telemetría | `telemetria/hilo`, `sede/resumen`, registros | — |

Detalle de hooks: [05-api-y-hooks.md](05-api-y-hooks.md).

---

## 8. Anti-patrones

| Evitar | Por qué |
|---|---|
| Guardar JWT en `localStorage` sin evaluación de XSS | Preferir httpOnly cookie (decisión infra) |
| Filtrar bandeja “ajena” en cliente para asesores | Viola F1; da falsa seguridad |
| Store global con todo el CRM | Drift vs servidor; conflictos de reasignación |
| Optimistic update de precios de catálogo en brief | Precios solo vienen del backend |
| Suscribir telemetría ops al asesor | Fuera de matriz de acceso |

---

## 9. Criterio de cierre

Quedan definidos: stack de estado propuesto, query keys, contextos mínimos, estrategia F3, flujos lead/escalación/expediente/carga/ops y el mapa superficie→datos. **Implementado en código: 0 %** — pendiente scaffold Next.js + QueryClient + AuthProvider.
