# Frontend — cliente API y hooks

Contrato del **cliente HTTP**, endpoints consumidos por el panel y **hooks** personalizados.

**Estado del repo:** sin código Next.js / `fetch` / hooks. Todo lo siguiente es **propuesto**, derivado de [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) §4 y RBAC ([../backend/06-guards-y-rbac.md](../backend/06-guards-y-rbac.md)). Shapes canónicos viven en backend DTOs; aquí solo el consumo UI.

---

## 1. Cliente API (propuesto)

### 1.1 Ubicación y forma

```
apps/web/src/lib/api/client.ts     # fetch wrapper
apps/web/src/lib/api/endpoints/*   # funciones por dominio
packages/shared/                   # Zod + types (ver 07-tipos.md)
```

Base URL: `process.env.NEXT_PUBLIC_API_URL` (sin trailing slash). Paths relativos al contrato backend (`/auth/login`, `/conversaciones`, …). Prefijo `/api/v1` **solo si** Nest lo adopta al implementar — hoy los DTOs no lo incluyen; el cliente debe parametrizar `API_PREFIX`.

### 1.2 Envelope

Éxito / lista / error según backend §1.3:

```ts
type ApiSuccess<T> = { data: T };
type ApiList<T> = { data: T[]; meta: { page: number; pageSize: number; total: number } };
type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};
```

El cliente:

1. Adjunta `Authorization: Bearer <accessToken>` **o** confía en cookie httpOnly (misma decisión que auth).
2. `Content-Type: application/json` salvo multipart (import catálogo / upload conocimiento).
3. Parsea envelope; lanza `ApiError` tipado con `status`, `code`, `message`.
4. En **401**: limpia sesión y redirige a `/login` (una sola vez; evitar loop).
5. En **403/404**: propaga mensaje de producto al toast/banner (backend §7).

### 1.3 Helpers

| Helper | Uso |
|---|---|
| `api.get<T>(path, query?)` | GET |
| `api.post<T>(path, body?)` | POST |
| `api.patch<T>(path, body)` | PATCH |
| `api.postForm<T>(path, FormData)` | Import / upload |
| `unwrap(res)` | Extrae `data` |

No llamar webhooks Meta/Twilio desde el panel.

---

## 2. Catálogo de endpoints → UI

Roles: **A** asesor · **C** coordinador · **D** admin. Scope real en API.

| Método | Path | Response / body (DTO) | Roles UI | Superficie |
|---|---|---|---|---|
| `POST` | `/auth/login` | `LoginRequest` → `LoginResponse` | público | Login |
| `GET` | `/auth/me` | `MeResponse` (= user) | A/C/D | Bootstrap sesión |
| `POST` | `/auth/logout` | — (**propuesto**; no en DTOs aún) | A/C/D | Logout |
| `POST` | `/auth/refresh` | — (**gap**; ver auth) | A/C/D | Renovar token |
| `GET` | `/conversaciones` | `BandejaItem[]` + meta + `resumenPropio?` | A/C/D | Bandeja |
| `GET` | `/conversaciones/:id` | `ConversacionDetail` | A*/C/D | Hilo |
| `POST` | `/conversaciones/:id/mensajes` | `EnviarMensajeHumanoRequest` | A*/C/D | Responder |
| `POST` | `/conversaciones/:id/tomar-control` | body opcional | A*/C/D | CTA control |
| `POST` | `/conversaciones/:id/devolver-a-bot` | —; default **409** v1 | A*/C/D | Opcional |
| `GET` | `/oportunidades/:id` | `OportunidadDetail` | A*/C/D | Expediente |
| `PATCH` | `/oportunidades/:id` | `ActualizarOportunidadRequest` | A*/C/D | Guardar / etapa |
| `GET` | `/oportunidades/:id/brief` | `BriefCotizacion` | A*/C/D | Brief |
| `GET` | `/oportunidades?vista=pipeline` | tarjetas pipeline | A*/C/D | Pipeline |
| `POST` | `/asignaciones` | `ReasignarRequest` → `AsignacionDto` | C/D | Carga |
| `GET` | `/carga` | shape carga §3.5 | C/D | Carga |
| `PATCH` | `/usuarios/:id/disponibilidad` | `{ disponible }` | C/D | Carga |
| `GET` | `/notificaciones` | `NotificacionDto[]` | A/C/D | Alertas |
| `POST` | `/notificaciones/:id/leer` | — | A/C/D | Alertas |
| `POST` | `/notificaciones/:id/atender` | — | A/C/D | Alertas |
| `GET` | `/telemetria/hilos/:conversacionId` | eventos | D (+C pacto) | Telemetría |
| `GET` | `/telemetria/sede/:sedeId/resumen` | resumen sede | D (+C) | Telemetría |
| `GET` | `/telemetria/registros/recuperacion/:id` | `RegistroRecuperacionDto` | D | Drill-down |
| `GET` | `/telemetria/registros/catalogo/:id` | `RegistroConsultaCatalogoDto` | D | Drill-down |
| `GET` | `/catalogo/paquetes` | lista (**path list implícito**) | C(L)/D | Catálogo |
| `GET` | `/catalogo/paquetes/:id` | `PaqueteDto` | C(L)/D | Detalle |
| `POST` | `/catalogo/paquetes` / `PATCH`… | CRUD (**detalle campos por confirmar**) | D | Catálogo |
| `POST` | `/catalogo/paquetes/:id/publicar` | — | D | Publicar |
| `POST` | `/catalogo/importaciones` | multipart Excel/CSV **precios/SKUs** → `ImportacionCatalogo` (`filasOk` / `filasError`) | D | Import catálogo (**no** RAG) |
| `GET` | `/catalogo/importaciones` | historial importaciones | C(L)/D | Catálogo |
| `GET` | `/conocimiento/documentos` | `DocumentoFuenteDto[]` + meta; query `tipoMaterial?`, `estado?` | C(L)/D | Conocimiento |
| `GET` | `/conocimiento/documentos/:id` | `DocumentoFuenteDto` + `job` (`pipelineEstado`) | C(L)/D | Detalle / poll |
| `POST` | `/conocimiento/documentos` | **multipart** `file`+`titulo`+`tipo`+`sedeId?` → `{ documento, jobId }` | D | Upload multimodal |
| `GET` | `/conocimiento/jobs/:jobId` | `JobIngestaDto` (`pipelineEstado`, `progresoPct`, error) | C(L)/D | Poll job |
| `POST` | `/conocimiento/documentos/:id/publicar` | encola ingesta; SLA texto &lt; 60 s / foto &lt; 90 s / video &lt; 5 min | D | Publicar |
| `POST` | `/conocimiento/documentos/:id/archivar` | — | D | Archivar |
| `GET` | `/cupo` o `/cupo/uso` | consumo vs tope (**gap DTO**) | C/D | Uso y cupo |

Cableado UI completo (flujos, toasts, RBAC, UI-KNW): [08-cableado-conocimiento-multimodal.md](08-cableado-conocimiento-multimodal.md). Allowlist MIME: pdf, docx, xlsx, csv, jpeg, png, webp, mp4, mov, webm. XLS de **precios** solo por `/catalogo/importaciones`; XLS narrativo (FAQ) sí puede ir a conocimiento.

\* Asesor: solo recursos con asignación vigente (Ownership).  
**(L)** = lectura.

### 2.1 Query params bandeja (`ConversacionListQuery`)

`canal?`, `estadoBot?`, `calificacion?`, `listoParaCotizar?`, `urgenciaSla?`, `asesorId?`, `sinAsignar?`, `page?`, `pageSize?`.

Cliente asesor: **no enviar** `asesorId` / `sinAsignar` (API los ignora o 403).

### 2.2 Endpoints admin ligeros (usuarios, sedes, enrutador)

Mencionados en superficies y dominios; **no hay DTOs HTTP detallados aún** en `05-dtos-y-tipos.md`. El frontend debe esperar:

- List/CRUD usuarios y roles
- Sedes activar/inactivar
- Parámetros de regla de asignación (lectura C, escritura D)

Documentar paths concretos cuando backend los fije. Hasta entonces: stubs tipados + feature flag `ADMIN_API_READY`.

---

## 3. Funciones de endpoint (capa fina)

Ejemplo de forma (propuesto):

```ts
// conversaciones.ts
export const conversacionesApi = {
  list: (q: ConversacionListQuery) =>
    api.get<ApiList<BandejaItem> & { resumenPropio?: ResumenPropio }>('/conversaciones', q),
  get: (id: string) => api.get<ConversacionDetail>(`/conversaciones/${id}`),
  sendMessage: (id: string, body: EnviarMensajeHumanoRequest) =>
    api.post(`/conversaciones/${id}/mensajes`, body),
  takeControl: (id: string, body?: { motivo?: string }) =>
    api.post(`/conversaciones/${id}/tomar-control`, body ?? {}),
};
```

Misma capa para `oportunidadesApi`, `asignacionesApi`, `notificacionesApi`, `telemetriaApi`, `catalogoApi`, `conocimientoApi`, `authApi`.

---

## 4. Hooks personalizados (propuesto)

Convención: `use` + dominio; wrappers de `useQuery` / `useMutation` con keys de [04-estado-y-datos.md](04-estado-y-datos.md).

### 4.1 Auth

| Hook | Tipo | Comportamiento |
|---|---|---|
| `useAuth()` | context | `user`, `login`, `logout`, `rol`, `can(capability)` |
| `useMe()` | query | `['auth','me']`; enabled si hay sesión |
| `useLogin()` | mutation | `POST /auth/login` → set session → invalidate me |

### 4.2 Bandeja / conversación

| Hook | |
|---|---|
| `useBandeja(query)` | Lista + meta; `refetchInterval` si no hay realtime |
| `useResumenPropio()` | Conteos urgentes/listos/abiertos (o viene en list) |
| `useConversacion(id)` | Detail + mensajes |
| `useEnviarMensaje(id)` | Mutation; invalidate detail + list |
| `useTomarControl(id)` | Mutation; optimistic opcional `estadoBot → humano` |
| `useDevolverABot(id)` | Mutation; manejar 409 como “no habilitado en v1” |

### 4.3 Oportunidad / pipeline

| Hook | |
|---|---|
| `useOportunidad(id)` | Detail |
| `useBrief(id)` | Brief; puede ser select del detail si viene embebido |
| `useActualizarOportunidad(id)` | PATCH; invalidar detail, brief, pipeline, bandeja |
| `usePipeline(query)` | `vista=pipeline` |

### 4.4 Asignación / alertas / telemetría / ops

| Hook | Roles | |
|---|---|---|
| `useCarga(sedeId?)` | C/D | GET carga |
| `useReasignar()` | C/D | POST asignaciones |
| `useDisponibilidad(userId)` | C/D | PATCH |
| `useNotificaciones(query)` | A/C/D | list |
| `useMarcarNotificacion()` | | leer / atender |
| `useTelemetriaHilo(convId)` | D/(C) | |
| `useTelemetriaSede(sedeId, periodo)` | D/(C) | |
| `useRegistroRecuperacion(id)` | D | lazy al abrir drill-down |
| `useRegistroCatalogo(id)` | D | |
| `useDocumentosConocimiento(q)` | C/D | lista; filtros `tipoMaterial` |
| `useDocumentoConocimiento(id)` | C/D | detail; `refetchInterval` ~2 s si `pipelineEstado` ∈ {`en_cola`,`procesando`,`indexando`} |
| `useJobIngesta(jobId)` | C/D | poll dedicado `GET /conocimiento/jobs/:id`; same interval rule |
| `useUploadDocumentoConocimiento()` | D | `postForm` multipart; invalidate `conocimiento/*`; arranca poll |
| `usePublicarDocumento()` | D | POST publicar; poll hasta `listo`\|`error` |
| `useArchivarDocumento()` | D | invalidate list/detail |
| `useReintentarIngesta(id)` | D | reingesta propuesta; mismo poll |
| `usePaquetes(q)` / `usePaquete(id)` | C/D | |
| `useImportarCatalogo()` | D | multipart catálogo; **no** keys de job RAG |
| `useImportacionesCatalogo(q)` | C/D | historial import |
| `useCupo(periodo?)` | C/D | **cuando exista DTO** |

Detalle de invalidaciones y anti-alcance (no reenviar media al lead): [08-cableado-conocimiento-multimodal.md](08-cableado-conocimiento-multimodal.md) §5–§8.

### 4.5 Capabilities helper

```ts
function useCan() {
  const { user } = useAuth();
  return {
    verCarga: user?.rol === 'coordinador' || user?.rol === 'admin',
    verConocimiento: user?.rol === 'admin' || user?.rol === 'coordinador',
    mutarConocimiento: user?.rol === 'admin',
    publicarCatalogo: user?.rol === 'admin',
    importarCatalogo: user?.rol === 'admin',
    verTelemetriaSede: user?.rol === 'admin' || user?.rol === 'coordinador',
    // … espejo matriz 00-superficies §4 y frontend/08 §9
  };
}
```

Solo UX; no sustituye 403.

---

## 5. Invalidaciones típicas post-mutation

| Mutation | Invalidar |
|---|---|
| Enviar mensaje / tomar control | `conversaciones/detail`, `list`, telemetría hilo |
| PATCH oportunidad | `oportunidades/detail`, `brief`, `pipeline`, `conversaciones/list` |
| Reasignar | `carga`, `conversaciones/list`, `oportunidades/detail`, `notificaciones` |
| Atender notificación | `notificaciones/list`, posiblemente bandeja |
| Upload / publicar conocimiento | `conocimiento/documentos`, `conocimiento/documento`, `conocimiento/job` (+ poll hasta terminal) |
| Archivar conocimiento | `conocimiento/*` |
| Importar catálogo | `catalogo/importaciones`, `catalogo/paquetes` (**no** `conocimiento/job`) |
| Publicar catálogo / precio | `catalogo/*`; briefs abiertos si montados |

---

## 6. Errores y UX

| HTTP | Acción UI |
|---|---|
| 401 | Logout + `/login` |
| 403 | Toast con `error.message` |
| 404 | Empty state expediente/hilo (“No encontramos…”) |
| 409 | Copy de conflicto (devolver-a-bot, etc.) |
| 422 | Mapear `details` a campos de formulario |
| Network | Retry Query + banner offline |

Códigos de negocio (`SIN_PRECIO_VIGENTE`, etc.) son del bot/tools; el panel admin de catálogo muestra el mismo `error.code` en preview si el backend lo reexpone.

Códigos de upload/pipeline conocimiento → toast ([08](08-cableado-conocimiento-multimodal.md) §7): `MIME_NO_PERMITIDO`, `VIDEO_DEMASIADO_LARGO`, `ARCHIVO_DEMASIADO_GRANDE`, `PIPELINE_ERROR`.

---

## 7. Gaps respecto a backend DTOs

| Gap | Impacto frontend |
|---|---|
| Sin `POST /auth/logout` ni refresh documentados | Definir en kick-off; ver [06-auth-y-config.md](06-auth-y-config.md) |
| Sin DTO HTTP de **cupo/uso** | Superficie 3.9 bloqueada a contrato |
| Detalle fino de retry job / URL firmada Asset | Completar al implementar Nest + [08](08-cableado-conocimiento-multimodal.md) |
| List/CRUD catálogo campos CRUD aún parciales en DTOs backend | Completar paths al implementar Nest |
| Admin usuarios/sedes/enrutador sin paths | Feature flag hasta contrato |
| Canal realtime no especificado en infra | Polling fallback documentado en 04 |
| Prefijo `/api/v1` no fijado | Env `NEXT_PUBLIC_API_PREFIX` |

---

## 8. Criterio de cierre

Quedan el cliente envelope, la tabla endpoint→DTO→superficie→rol (incl. multipart conocimiento + jobs + import catálogo), la capa `*Api`, los hooks por dominio (poll `pipelineEstado`) y las invalidaciones. **Código implementado: ninguno.** Detalle UI multimodal: [08-cableado-conocimiento-multimodal.md](08-cableado-conocimiento-multimodal.md). Próximo paso de engineering (post Fase Doc): scaffold + `api.client` + hooks de auth y bandeja como vertical slice.
