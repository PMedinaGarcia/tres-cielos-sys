# Frontend — tipos TypeScript y alineación con backend

Contrato de **tipos del panel** y su relación con [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md).

**Estado del repo:** no hay `packages/shared`, ni Zod, ni `.ts` de app. Todo **propuesto**. Fuente de verdad de wire format: docs backend DTOs hasta existir código Nest/Zod (entonces el código gana y ambos docs se sincronizan).

---

## 1. Estrategia de tipos (propuesto)

| Capa | Ubicación | Herramienta |
|---|---|---|
| Enums + DTOs compartidos | `packages/shared` (o `libs/shared`) | **Zod** → `z.infer` |
| Cliente API | `apps/web` importa shared | Types de request/response |
| View models UI | `apps/web/src/types/view` | Types solo frontend (derivados) |
| Server Actions / RSC | mismos schemas Zod | Validación en frontera |

Reglas de naming (backend §1.1):

- JSON / TypeScript de API: **camelCase** (`listoParaCotizar`, `sedeId`).
- Enums de dominio en string: **snake_case** español (`en_exploracion`, `listo_para_cotizar` como valor de calificación/etapa según catálogo cerrado).
- No redefinir enums con inglés distinto (`qualified` ❌).

Validación:

- Forms UI: Zod (espejo de DTO).
- Nest: `class-validator` (backend). Mantener **paridad de enums y obligatoriedad**; no hace falta generar class-validator desde Zod en v1.

---

## 2. Enums compartidos (reexportar del contrato backend)

Copiar/portar a Zod **exactamente** los unions de backend §2:

```ts
// packages/shared/src/enums.ts (propuesto)
export const RolUsuario = z.enum(['asesor', 'coordinador', 'admin']);
export const Canal = z.enum(['facebook', 'instagram', 'whatsapp']);
export const Calificacion = z.enum(['calificado', 'en_exploracion']);
export const EtapaPipeline = z.enum([
  'nuevo_bot', 'calificado', 'contactado', 'propuesta',
  'negociacion', 'ganado', 'perdido',
]);
export const EstadoBot = z.enum(['activo', 'escalado', 'humano']);
export const UrgenciaSla = z.enum(['dentro_ventana', 'fuera_ventana', 'sin_sla']);
export const MotivoHandoff = z.enum([
  'solicitud_usuario', 'rerank_bajo', 'sin_catalogo', 'sin_cita_rag',
  'conflicto', 'queja', 'descuento_fuera_catalogo', 'sede_no_cubierta',
  'ambiguedad', 'otro',
]);
export const TipoNotificacion = z.enum([
  'lead_nuevo', 'lead_calificado', 'listo_para_cotizar', 'escalacion', 'otro',
]);
export const EstadoNotificacion = z.enum(['pendiente', 'leida', 'atendida']);
export const TipoEvento = z.enum(['boda', 'xv', 'corporativo', 'social', 'otro', 'multi']);
export const MotivoPerdido = z.enum([
  'precio', 'fecha', 'competencia', 'sin_respuesta', 'otro',
]);
export const EstadoPublicacion = z.enum(['borrador', 'publicado', 'archivado']);
export const RutaOrquestador = z.enum(['guion', 'catalogo', 'rag', 'handoff', 'safe']);

/** Material de biblioteca K / Asset (multimodal) — database/03, backend/08 */
export const TipoMaterial = z.enum([
  'pdf', 'docx', 'xlsx', 'csv', 'imagen', 'video',
]);

/** Job de ingesta (texto / visión / whisper → embed+FTS) */
export const PipelineEstado = z.enum([
  'en_cola', 'procesando', 'indexando', 'listo', 'error',
]);

/** Origen del texto indexado (auditoría; telemetría) */
export const OrigenDerivacion = z.enum([
  'texto_nativo', 'vision', 'whisper', 'xls_narrativo',
]);
// … resto §2 según necesidad de UI
```

Tipos: `export type RolUsuario = z.infer<typeof RolUsuario>;`

---

## 3. Schemas DTO usados por el panel

Prioridad de implementación (vertical slice):

| Schema Zod | Origen backend | Consumo UI |
|---|---|---|
| `LoginRequest` / `LoginResponse` / `UserDto` | §4.1 | Auth |
| `BandejaItem` | §3.6 | Bandeja |
| `ResumenPropio` | §3.6 | Header asesor |
| `ConversacionListQuery` | §4.2 | Filtros |
| `ConversacionDetail` / `MensajeDto` | §4.2 | Hilo |
| `EnviarMensajeHumanoRequest` | §4.2 | Composer |
| `OportunidadDetail` | §4.3 | Expediente |
| `ActualizarOportunidadRequest` | §4.3 | Form |
| `BriefCotizacion` | §3.1 | Brief panel |
| `PipelineCard` | §4.3 (tarjeta mínima) | Pipeline |
| `CargaResponse` / `CargaAsesor` | §3.5 | Carga |
| `ReasignarRequest` / `AsignacionDto` | §4.4 | Reasignar |
| `NotificacionDto` | §4.5 | Alertas |
| `EventoOperativo` (+ payloads) | §3.2–3.4 | Telemetría / timeline |
| `PaqueteDto` / import result | §4.7 | Catálogo |
| `DocumentoFuenteDto` / `JobIngestaDto` | §4.8 + multimodal | Conocimiento |
| `TipoMaterial` / `PipelineEstado` | database/03, backend/08 | Upload, badges, poll |
| `RegistroRecuperacionDto` (+ `tipoMaterial`) | telemetría | Drill-down |

Envelope genérico:

```ts
const ApiSuccess = <T extends z.ZodTypeAny>(data: T) => z.object({ data });
const ApiListMeta = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});
```

### 3.1 Tipos compuestos ya definidos en backend

Reutilizar shapes:

- `FechaTentativa`, `PresupuestoOrientativo`
- `BriefCotizacion.paquete` (`modo: 'sku' | 'a_medida'`)
- Payloads de `EventoOperativo` discriminados por `tipo` / `ruta`

No aplanar enums en booleans inventados (`isEscalated` como fuente de verdad ❌); derivar en view model si hace falta.

---

## 4. View models solo frontend

Tipos que **no** viajan en API; adaptan DTO → UI.

```ts
/** Derivado de BandejaItem + reloj cliente */
type BandejaRowVM = BandejaItem & {
  slaLabel: string;           // "12 min" / "Fuera de ventana"
  priorityRank: number;       // espejo orden producto
  showSinAsignarBadge: boolean; // false forzado si rol=asesor
};

type NavItemVM = {
  href: string;
  label: string;
  roles: RolUsuario[];
  flag?: keyof Features;
};

type BriefCompletenessVM = {
  listoParaCotizar: boolean;
  missingFields: string[]; // labels ES para el asesor
};

/** Upload / job — solo UI; DTO canónico en JobIngestaDto */
type UploadConocimientoFormVM = {
  titulo: string;
  tipoDocumento: string; // TipoDocumento
  sedeId: string | null;
  file: File | null;
  tipoMaterialInferido?: TipoMaterial;
  destinoXlsx?: 'catalogo' | 'narrativo'; // bifurcar UI
};

type JobPipelineVM = {
  jobId: string;
  documentoId: string;
  pipelineEstado: PipelineEstado;
  progresoPct: number | null;
  mensajeEstado: string;
  slaLabel: string;           // "< 60 s" / "foto < 90 s" / "video < 5 min"
  isTerminal: boolean;        // listo | error
  isPolling: boolean;
  errorCode?: string | null;  // MIME_NO_PERMITIDO | PIPELINE_ERROR | …
};

type DocumentoBibliotecaRowVM = DocumentoFuenteDto & {
  mimeBadge: TipoMaterial;
  job: JobPipelineVM | null;
  canPublish: boolean;
  canArchive: boolean;
};
```

Cableado completo: [08-cableado-conocimiento-multimodal.md](08-cableado-conocimiento-multimodal.md).

Cálculo de `missingFields` alineado a backend §6.1–6.2 (calificado / listo_para_cotizar), no a criterios inventados.

---

## 5. Matriz alineación frontend ↔ backend

| Concepto UI (superficies) | Campo / DTO | Notas |
|---|---|---|
| Badge calificado | `calificacion === 'calificado'` | |
| Badge listo cotizar | `listoParaCotizar` | camelCase API; copy UI puede decir “listo para cotizar” |
| Estado bot | `estadoBot` | activo / escalado / humano |
| Urgencia SLA | `urgenciaSla` | UI 15–30 min (env) |
| Motivo escalación | `motivoHandoff` | Enum cerrado |
| Etapa pipeline | `etapa` | `EtapaPipeline` |
| Brief | `BriefCotizacion` | Incluye `precioCatalogoDesactualizado` |
| Carga asesor | `CargaAsesor.metricas` | |
| Alertas | `NotificacionDto.tipo` | Incluye valor enum `listo_para_cotizar` |
| Telemetría rutas | `RutaOrquestador` en payload | |
| Material RAG | `tipoMaterial` / `TipoMaterial` | Badge biblioteca + drill-down |
| Job ingesta | `pipelineEstado` / `PipelineEstado` | Poll UI; no confundir con import catálogo |
| Rol menú | `user.rol` | |

Inconsistencia a vigilar: en producto/docs a veces aparece `listo_para_cotizar` (snake) como **nombre de flag de dominio**; en JSON de API es **`listoParaCotizar`**. El frontend TypeScript usa camelCase en props de DTO.

---

## 6. Auth types

```ts
type UserDto = {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  sedeIds: string[];
  disponible: boolean;
  activo: boolean;
};

type LoginResponse = {
  accessToken: string;
  expiresIn: number;
  user: UserDto;
};
```

`PanelAuthContext` (guards §6) puede vivir en shared como tipo de sesión; mapear `UserDto` → context en AuthProvider. Añadir `orgId` cuando backend lo exponga.

---

## 7. Generación y drift

| Práctica | v1 |
|---|---|
| OpenAPI codegen | Opcional después de que Nest exponga Swagger |
| Duplicar enums a mano en web y shared | Evitar: un solo `packages/shared` |
| Tests de contrato | Snapshot Zod parse de fixtures JSON del doc backend |
| Al cambiar DTO backend | PR actualiza shared + este doc + `05-dtos-y-tipos.md` |

---

## 8. Gaps de tipado

| Gap | Acción |
|---|---|
| DTO cupo/uso ausente | Definir en backend; luego `CupoUsoDto` en shared |
| Admin usuarios/sedes/enrutador | Schemas cuando existan paths |
| `orgId` no en LoginResponse | Extender `/auth/me` |
| Refresh token | Añadir a LoginResponse o cookie-only |
| List endpoints catálogo/conocimiento | Query params + `PaqueteListItem` si difiere de `PaqueteDto` completo |
| URL firmada Asset (preview admin) | Tipar cuando backend la exponga; ver frontend/08 |
| Realtime event payload | Tipar `PanelRealtimeEvent` (ver 04) en shared; incluir `pipelineEstado` en `conocimiento.job` |

---

## 9. Criterio de cierre

Quedan la estrategia Zod/shared, la lista de schemas prioritarios (incl. `TipoMaterial`, `PipelineEstado`, view models de upload/job), la matriz UI↔DTO y los gaps. **Tipos en código: ninguno aún.** Primer entregable de engineering: `packages/shared` con enums + `BandejaItem` + `UserDto` parseando fixtures del doc backend.
