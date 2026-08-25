# Frontend — cableado conocimiento multimodal

Contrato de **UI ↔ API** para la superficie `/conocimiento` (biblioteca narrativo-RAG multimodal) y su frontera con `/catalogo` (import XLS de precios). El panel Next.js solo consume Nest; no parsea PDF/video ni llama a OpenAI/Cohere.

**Estado del repo:** documentación **Fase Doc** previa a implementación en `apps/web`. Sin código de upload/hooks aún. Contratos cruzados: [../backend/08-ingesta-multimodal.md](../backend/08-ingesta-multimodal.md), [../backend/09-aceptacion-y-matriz-tests.md](../backend/09-aceptacion-y-matriz-tests.md), [../database/03-assets-y-fragmentos-multimodales.md](../database/03-assets-y-fragmentos-multimodales.md), [05-api-y-hooks.md](05-api-y-hooks.md), [07-tipos.md](07-tipos.md).

Envelope: éxito `{ data }` / error `{ error: { code, message, details? } }` ([../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md)).

---

## 1. Propósito y anti-alcance UI

### 1.1 Qué cablea este entregable

- Upload multipart de materiales autorizados a la biblioteca K.
- Feedback de job (`pipelineEstado`) con polling TanStack Query.
- Preview ligero (metadatos + miniatura si aplica) y badges MIME / tipo.
- Separación estricta: **XLS de precios → `/catalogo`**, narrativa → `/conocimiento`.
- Drill-down de telemetría con `tipoMaterial` en recuperaciones RAG.

### 1.2 Anti-alcance (v1)

| No hacer en el panel | Motivo |
|---|---|
| **Reenviar media de la biblioteca al lead** (adjuntar PDF/foto/video del Asset al hilo Meta/WA) | El bot responde en **texto** con cita a `nombreArchivoCita`; reenvío de binarios es change order |
| Cotizar o mostrar montos desde preview OCR / fragmento | Montos solo vía tools de catálogo (C3) |
| Auto-publicar adjuntos entrantes del lead a la biblioteca K | Adjuntos de canal ≠ inventario autorizado |
| Importar hoja de precios por el dropzone de `/conocimiento` | Redirigir / CTA a `/catalogo` |
| Montar superficie de conocimiento para **asesor** | RBAC: sin acceso |

---

## 2. Superficies involucradas

| Ruta | Rol de esta doc |
|---|---|
| `/conocimiento` | Biblioteca multimodal: listado, dropzone, job bar, publicar/archivar |
| `/catalogo` | Import Excel/CSV de SKUs/precios (`POST /catalogo/importaciones`) — **no** usa el MediaRouter narrativo |
| `/telemetria/...` | Enlace a `RegistroRecuperacion` con filtro/badge `tipoMaterial` |

Detalle de pantallas: [00-superficies.md](00-superficies.md) §3.7–3.8 · Componentes: [03-componentes.md](03-componentes.md) §5.6.

---

## 3. Flujos UI

### 3.1 Admin — upload → progress → publicado / listo / error

```
1. Admin abre /conocimiento
2. Dropzone (o file picker) → validación cliente MIME/extensión + tamaño
3. Completa título, tipo documental (FAQ/ficha/…), sede? (null = global)
4. POST multipart → 201 { data: { documento, jobId } }
5. UI muestra fila en borrador + JobPipelineBar (pipelineEstado)
6. Poll GET documento|job mientras estado ∈ { en_cola, procesando, indexando }
7a. listo → badge success; CTA «Publicar» si aún borrador
    (o auto-listo post-publicación según flujo §3.2)
7b. error → toast PIPELINE_ERROR + mensaje actionable; CTA reintentar / archivar
```

Estados visuales de la fila:

| `pipelineEstado` | Copy UI | Barra |
|---|---|---|
| `en_cola` | En cola | indeterminada / 0–10 % |
| `procesando` | Extrayendo (texto / visión / audio) | % del job si API lo envía |
| `indexando` | Indexando (embed + FTS) | cerca del final |
| `listo` | Listo | 100 %, color success |
| `error` | Error de pipeline | danger + detalle |

SLA de feedback percibido (espejo backend):

| Material | Objetivo UI a `listo` o error visible |
|---|---|
| PDF / DOCX / CSV narrativo / XLS narrativo | **&lt; 60 s** |
| Imagen (jpeg/png/webp) | **&lt; 90 s** |
| Video (mp4/mov/webm) | **&lt; 5 min** (máx. duración fuente **5 min**) |

Si el job supera el SLA sin terminal: banner warning + mantener poll (no spinner infinito) — alinea D-KNW-6 / UI-KNW-6.

### 3.2 Admin — publicar versión vigente

```
Borrador con pipeline listo (o publish que encola ingesta)
  → POST /conocimiento/documentos/:id/publicar
  → Poll hasta listo|error
  → Copy: «Vigente para el bot» + publicadoEn
```

Solo `estado === 'publicado'` alimenta hybrid search. Archivar → exclusión inmediata; UI refleja `archivado` sin esperar poll largo.

### 3.3 Coordinador — lectura

- Ve listado (y detalle) en modo solo lectura.
- **Sin** dropzone de escritura ni CTAs publicar/archivar (salvo pacto explícito de borradores — default: bloqueado).
- Puede ver `pipelineEstado` para no reportar “el bot no sabe X” mientras indexa.

### 3.4 Separación catálogo XLS

Si el admin suelta un `.xlsx`/`.csv` en `/conocimiento`:

1. Detectar extensión.
2. Modal/inline: «¿Es lista de precios/SKUs o FAQ narrativa?»
3. **Precios/SKUs** → deep-link a `/catalogo` + `ImportCatalogoForm` (`POST /catalogo/importaciones`).
4. **Narrativa** (FAQ / descripción larga sin montos) → continuar upload conocimiento con `tipoMaterial: xlsx|csv` y ruta MediaRouter narrativo.

Nunca mezclar el resultado de import catálogo (`filasOk` / `filasError`) con `pipelineEstado` de RAG.

### 3.5 Error de validación inmediata (sin job)

```
Cliente o API rechaza MIME / duración / tamaño
  → Toast con error.code
  → No crear fila “fantasma” de documento (o borrarla si 4xx post-create)
```

---

## 4. Contrato de endpoints

Roles UI: **D** = admin (write) · **C** = coordinador (lectura) · **A** = asesor (sin superficie).

### 4.1 Conocimiento — multipart y CRUD

| Método | Path | Body / query | Response `data` | Roles |
|---|---|---|---|---|
| `GET` | `/conocimiento/documentos` | filtros: `estado?`, `tipoMaterial?`, `sedeId?`, `page` | lista + meta | C(L)/D |
| `GET` | `/conocimiento/documentos/:id` | — | `DocumentoFuenteDto` (+ `asset`, `job`) | C(L)/D |
| `POST` | `/conocimiento/documentos` | **multipart** (abajo) | `{ documento, jobId }` | D |
| `POST` | `/conocimiento/documentos/:id/publicar` | — o `{ forzarReingesta? }` | `{ documento, jobId }` | D |
| `POST` | `/conocimiento/documentos/:id/archivar` | — | `DocumentoFuenteDto` | D |
| `GET` | `/conocimiento/jobs/:jobId` | — | `JobIngestaDto` | C(L)/D |

#### Multipart `POST /conocimiento/documentos`

| Campo form | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `file` | binary | sí | Un archivo por request en v1 |
| `titulo` | string | sí | Visible en biblioteca |
| `tipo` | `TipoDocumento` | sí | FAQ, ficha_sede, política, … (inventario K) |
| `sedeId` | UUID \| omitido | no | Omitido / vacío = global |
| `tipoMaterial` | `TipoMaterial` | no | Si se omite, el backend lo deriva del MIME |

`Content-Type: multipart/form-data` — el cliente usa `api.postForm` ([05-api-y-hooks.md](05-api-y-hooks.md) §1.3), **no** JSON.

#### Allowlist MIME / extensión (espejo backend)

| Extensión | MIME típico | `TipoMaterial` |
|---|---|---|
| `.pdf` | `application/pdf` | `pdf` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `docx` |
| `.xlsx` | spreadsheet OpenXML | `xlsx` |
| `.csv` | `text/csv` | `csv` |
| `.jpeg` / `.jpg` | `image/jpeg` | `imagen` |
| `.png` | `image/png` | `imagen` |
| `.webp` | `image/webp` | `imagen` |
| `.mp4` | `video/mp4` | `video` |
| `.mov` | `video/quicktime` | `video` |
| `.webm` | `video/webm` | `video` |

Cualquier otro → `MIME_NO_PERMITIDO` (422).

### 4.2 Job / polling

**`JobIngestaDto` (propuesto)**

```json
{
  "id": "uuid",
  "documentoId": "uuid",
  "pipelineEstado": "procesando",
  "progresoPct": 45,
  "tipoMaterial": "video",
  "mensajeEstado": "Transcribiendo audio…",
  "errorCode": null,
  "errorMessage": null,
  "actualizadoEn": "2026-07-28T18:00:00.000Z",
  "iniciadoEn": "2026-07-28T17:59:10.000Z"
}
```

El detalle de documento debe embeber el mismo shape en `job` / `jobIngesta` para un solo poll:

```ts
// Preferido en UI: un query
GET /conocimiento/documentos/:id  → data.job.pipelineEstado

// Alternativa si la lista no trae job fresco
GET /conocimiento/jobs/:jobId
```

Estados terminales: `listo` | `error`. Mientras no terminal → `refetchInterval` activo.

### 4.3 Catálogo — import (frontera)

| Método | Path | Body | Response | Roles |
|---|---|---|---|---|
| `POST` | `/catalogo/importaciones` | multipart Excel/CSV precios | `ImportacionCatalogo` | D |
| `GET` | `/catalogo/importaciones` | historial | lista | C(L)/D |

No reutilizar hooks de `pipelineEstado` RAG; el import reporta `filasOk` / `filasError` / `detalleErrores[]`.

### 4.4 Telemetría — drill-down `tipoMaterial`

| Método | Path | Uso UI |
|---|---|---|
| `GET` | `/telemetria/registros/recuperacion/:id` | Detalle; mostrar `tipoMaterial`, `nombreArchivoCita`, flag `noRecuperablePrecio` si aplica |
| `GET` | `/telemetria/hilos/:conversacionId` | Timeline; chip de material en eventos RAG |

El panel **no** descarga el binario del Asset en telemetría v1 salvo URL firmada de admin (opcional; gap hasta que backend lo exponga).

---

## 5. Hooks TanStack Query

Keys base (extiende [04-estado-y-datos.md](04-estado-y-datos.md)):

```ts
['conocimiento', 'documentos', query]
['conocimiento', 'documento', documentoId]
['conocimiento', 'job', jobId]
['catalogo', 'importaciones', query]
['telemetria', 'recuperacion', registroId]
```

### 5.1 Queries

| Hook | Key | Comportamiento |
|---|---|---|
| `useDocumentosConocimiento(query)` | `documentos` | Lista; `staleTime` ~15–30 s |
| `useDocumentoConocimiento(id)` | `documento` | Detail + job embebido |
| `useJobIngesta(jobId, { enabled })` | `job` | Poll dedicado si no se usa detail |
| `useImportacionesCatalogo(q)` | importaciones | Historial `/catalogo` |
| `useRegistroRecuperacion(id)` | telemetría | Lazy al abrir drill-down |

#### `refetchInterval` mientras procesa

```ts
function intervalMientrasPipeline(estado?: PipelineEstado) {
  if (!estado) return false;
  if (estado === 'listo' || estado === 'error') return false;
  // en_cola | procesando | indexando
  return 2_000; // 2 s; pausar si document.visibilityState === 'hidden'
}
```

Aplicar en `useDocumentoConocimiento` y/o `useJobIngesta`. Al pasar a terminal: invalidar `['conocimiento', 'documentos']` una vez.

### 5.2 Mutations

| Hook | Endpoint | `onSuccess` invalidaciones |
|---|---|---|
| `useUploadDocumentoConocimiento()` | `POST .../documentos` multipart | `conocimiento/documentos`; setQueryData del nuevo id; arrancar poll |
| `usePublicarDocumento()` | `POST .../publicar` | `documento`, `documentos`; poll job |
| `useArchivarDocumento()` | `POST .../archivar` | `documento`, `documentos` |
| `useReintentarIngesta(documentoId)` | publish con `forzarReingesta` o endpoint retry (**propuesto**) | igual que publicar |
| `useImportarCatalogo()` | `POST /catalogo/importaciones` | `catalogo/importaciones`, `catalogo/paquetes` |

No optimistic “publicado” hasta `pipelineEstado === 'listo'` + `estado === 'publicado'`.

### 5.3 Capabilities

```ts
// useCan() — espejo matriz §8
{
  verConocimiento: rol === 'admin' || rol === 'coordinador',
  mutarConocimiento: rol === 'admin',
  verCatalogo: rol === 'admin' || rol === 'coordinador',
  importarCatalogo: rol === 'admin',
}
```

Asesor: `RoleGate` / nav no montan `/conocimiento` ni `/catalogo` (escritura). Coordinador: lectura catálogo sí; conocimiento según §8.

---

## 6. Componentes

Inventario feature (carpeta propuesta `components/conocimiento/`):

| Componente | Responsabilidad |
|---|---|
| `ConocimientoDropzone` | Drag-and-drop; accept allowlist; rechazo local MIME; CTA archivo |
| `MimeTypeBadge` | Chip por `TipoMaterial` / extensión (pdf, docx, imagen, video, …) |
| `JobPipelineBar` | Barra + label `mensajeEstado` + %; estados terminales |
| `DocumentoConocimientoTable` | Lista: título, badges, estado publicación, job, acciones |
| `DocumentoPreviewPanel` | Metadatos, `nombreArchivoCita`, miniatura imagen si URL firmada; **sin** player de envío al lead |
| `PublishArchivarActions` | Solo admin; deshabilitar mientras `procesando` |
| `XlsxDestinoDialog` | Bifurcación catálogo vs narrativa |
| `PipelineErrorAlert` | Inline + link a reintentar |

Catálogo (sin mezclar): `ImportCatalogoForm`, `ImportHistory` ([03-componentes.md](03-componentes.md)).

Primitivos: `Toast`, `Badge`, `Progress`/`Spinner`, `Dialog`, `EmptyState`.

### 6.1 Preview rules

- **Imagen:** thumbnail si el backend entrega URL firmada de lectura admin.
- **Video:** no autoplay obligatorio; opcional poster; **no** botón “enviar al lead”.
- **PDF/DOCX:** icono + nombre archivo + páginas/chars si API los expone; sin editor embebido en v1.

---

## 7. Errores → toasts

Mapear `error.code` del envelope (prioridad sobre `message` genérico):

| `error.code` | HTTP típico | Toast (ES) | Acción UI |
|---|---|---|---|
| `MIME_NO_PERMITIDO` | 422 | «Este tipo de archivo no está permitido en la biblioteca.» | Resaltar allowlist en dropzone |
| `VIDEO_DEMASIADO_LARGO` | 422 | «El video supera el máximo de 5 minutos.» | Sugerir recorte / otro archivo |
| `ARCHIVO_DEMASIADO_GRANDE` | 413/422 | «El archivo excede el tamaño máximo.» | Mostrar límite MB de env |
| `PIPELINE_ERROR` | 200 job error / 500 | «No se pudo procesar el material.» + `error.message` | CTA reintentar; conservar borrador |
| `FORBIDDEN` / 403 | 403 | Mensaje de producto | Sin reintentar como asesor |
| Network | — | «Sin conexión; reintentaremos…» | Retry Query |

Toasts: variante danger para códigos de rechazo/pipeline; warning si SLA excedido sin terminal aún.

Validación Zod de forms (título vacío, etc.) → errores de campo, no toast de pipeline.

---

## 8. Telemetría drill-down `tipoMaterial`

En `/telemetria` (admin; coord según pacto):

1. Timeline del hilo marca eventos RAG.
2. Al abrir `RegistroRecuperacion`: badge `tipoMaterial` (`pdf` | `docx` | `imagen` | `video` | …).
3. Si `noRecuperablePrecio` / fragmento tariff-gated: aviso «Montos no salen de este material; ver consultas de catálogo».
4. Link cruzado a `RegistroConsultaCatalogo` cuando la ruta del orquestador fue `catalogo`.

Propósito UX: auditar si una mala respuesta vino de OCR de foto, video Whisper, o PDF — **no** BI de marketing.

---

## 9. Matriz rol × acciones

| Acción | Asesor | Coordinador | Admin |
|---|---|---|---|
| Ver `/conocimiento` | No | Sí (lectura) | Sí |
| Upload multipart | No | No* | Sí |
| Ver `pipelineEstado` / progress | No | Sí | Sí |
| Publicar / archivar | No | No* | Sí |
| Reintentar ingesta | No | No | Sí |
| Ver `/catalogo` | No | Lectura | Sí |
| `POST /catalogo/importaciones` | No | No | Sí |
| Preview Asset (admin URL) | No | Lectura limitada | Sí |
| Reenviar media biblioteca → lead | No | No | **No (v1)** |
| Telemetría `tipoMaterial` | No | Según pacto | Sí |

\* Borradores de conocimiento solo si Tres Cielos lo pacta; default go-live: escritura solo admin.

Gate de ruta: [02-routing-y-paginas.md](02-routing-y-paginas.md) · Auth: [06-auth-y-config.md](06-auth-y-config.md).

---

## 10. Criterios UI-KNW

Aceptación de cableado de panel (complementa D-KNW / D-MED en [../backend/09-aceptacion-y-matriz-tests.md](../backend/09-aceptacion-y-matriz-tests.md) y [../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md)).

| ID | Criterio | Evidencia |
|---|---|---|
| **UI-KNW-1** | Dropzone solo acepta allowlist pdf/docx/xlsx/csv/jpeg/png/webp/mp4/mov/webm | Intento MIME inválido → toast `MIME_NO_PERMITIDO` sin job |
| **UI-KNW-2** | Tras upload 201, la UI muestra progress y hace poll ≤ 2 s mientras no terminal | Network tab / Query devtools |
| **UI-KNW-3** | Estados `listo` y `error` son visibles; error muestra toast `PIPELINE_ERROR` + CTA | Caso fixture pipeline fail |
| **UI-KNW-4** | Video &gt; 5 min rechazado con `VIDEO_DEMASIADO_LARGO` antes o al validar API | Fixture duración |
| **UI-KNW-5** | Admin escribe; coordinador lee; asesor no navega ni muta | Prueba F1 / RoleGate |
| **UI-KNW-6** | Superado SLA sin terminal → banner actionable, no spinner infinito | Reloj de prueba |
| **UI-KNW-7** | XLS de precios no se indexa por el flujo narrativo; UI bifurca a `/catalogo` | `XlsxDestinoDialog` |
| **UI-KNW-8** | No existe control “enviar este Asset al lead” en v1 | Revisión UI |
| **UI-KNW-9** | Drill-down recuperación muestra `tipoMaterial` | Telemetría admin |
| **UI-KNW-10** | Envelope error mapeado a toast; 403 no rompe formularios | Caso rol |

---

## 11. Checklist de cableado FE ↔ BE

Usar en PR de implementación (código bloqueado hasta cerrar Fase Doc).

### Contrato

- [ ] Paths multipart y job coinciden con Nest (`/conocimiento/documentos`, `/conocimiento/jobs/:id`)
- [ ] Campos form: `file`, `titulo`, `tipo`, `sedeId?`, `tipoMaterial?`
- [ ] Enums `TipoMaterial` / `PipelineEstado` idénticos en `packages/shared` y Prisma
- [ ] Allowlist MIME alineada a [../backend/08-ingesta-multimodal.md](../backend/08-ingesta-multimodal.md)
- [ ] Import catálogo en path **separado** `/catalogo/importaciones`
- [ ] Códigos `MIME_NO_PERMITIDO`, `VIDEO_DEMASIADO_LARGO`, `PIPELINE_ERROR` documentados en filter Nest

### Cliente / hooks

- [ ] `api.postForm` sin forzar `Content-Type: application/json`
- [ ] `useUploadDocumentoConocimiento` + invalidaciones §5.2
- [ ] `refetchInterval` solo en estados no terminales; pause on hidden tab
- [ ] `useImportarCatalogo` no comparte keys de `conocimiento/job`

### UI / RBAC

- [ ] `RoleGate` + SideNav: asesor sin ítem conocimiento/catálogo write
- [ ] `JobPipelineBar` + `MimeTypeBadge` + dropzone
- [ ] Toasts §7
- [ ] Sin CTA reenvío media → lead
- [ ] Telemetría badge `tipoMaterial`

### UAT rápido

- [ ] PDF narrativo → listo &lt; 60 s → publicar → bot cita fuente
- [ ] Imagen → listo &lt; 90 s
- [ ] Video corto → listo &lt; 5 min; video largo → rechazo
- [ ] XLS precios → solo catálogo; FAQ xlsx → conocimiento sin montos en preview de precio

---

## 12. Criterio de cierre de este entregable

Quedan definidos flujos upload→job→terminal, contrato multipart/polling, hooks e invalidaciones, componentes, mapa de errores, telemetría por `tipoMaterial`, anti-alcance de reenvío, matriz RBAC, criterios **UI-KNW-1..10** y checklist FE↔BE. **Implementación en `apps/web`: pendiente** tras gate Fase Doc.
