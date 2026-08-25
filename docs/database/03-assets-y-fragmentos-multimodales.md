# Assets y fragmentos multimodales

Modelo conceptual de **materiales binarios** (PDF, Word, Excel/CSV, imagen, video) y de los **fragmentos vectoriales derivados** que alimentan el Agentic RAG. Complementa [01-modelo-conceptual.md](01-modelo-conceptual.md) §4 y [02-catalogo-paquetes.md](02-catalogo-paquetes.md). Contratos wire: [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md). Pipeline de parsers: [../backend/04-ingesta-conocimiento.md](../backend/04-ingesta-conocimiento.md) y (cuando exista) `08-ingesta-multimodal.md`.

Este documento **no** define SQL ni Prisma; fija entidades, atributos, índices conceptuales, invariantes anti-alucinación y la separación catálogo XLS vs narrativo.

## 1. Principios

| Principio | Implicación |
|---|---|
| Original en object storage | Todo binario de conocimiento o adjunto de canal vive en S3-compatible; **no** en BYTEA de Postgres a escala |
| Indexar derivados textuales | El RAG recupera texto (nativo, OCR/caption Vision, Whisper, XLS narrativo), nunca “el precio del PDF” |
| Montos solo `PaquetePrecio` | Ningún `FragmentoVectorial` es fuente de verdad de montos |
| Una versión publicada activa | Por `DocumentoFuente` (línea documental): a lo sumo una versión `publicado` recuperable |
| Canal ≠ biblioteca K | `AdjuntoMensaje` se persiste y clasifica; **no** se auto-publica al inventario de conocimiento |
| Auditoría de derivación | Cada fragmento declara `origen_derivacion` y flags (`no_recuperable_precio`) |

## 2. ER conceptual

```
Sede (opcional alcance)
  │
Organizacion
  │
  ├── Asset ─────────────────────────────────────────┐
  │     │                                            │
  │     ├── DocumentoFuente (0..1 por asset de K)     │
  │     │     └── FragmentoVectorial (1..N)           │
  │     │           ▲ hybrid (pgvector + FTS)        │
  │     │           └── RegistroRecuperacion (N)     │
  │     │                                            │
  │     └── AdjuntoMensaje (0..1 si origen=canal)     │
  │           └── Mensaje                            │
  │                 └── Conversacion / Oportunidad   │
  │                                                  │
  └── ImportacionCatalogo ←── Asset (xlsx/csv precios; sin FragmentoVectorial de montos)
```

Cardinalidades de negocio:

| Relación | Cardinalidad | Nota |
|---|---|---|
| `Asset` → `DocumentoFuente` | 0..1 | Un asset de biblioteca puede respaldar un documento; re-upload = nuevo asset o nueva versión |
| `DocumentoFuente` → `Asset` | 1 (v1) | El original publicado apunta a un `Asset`; object storage obligatorio |
| `DocumentoFuente` → `FragmentoVectorial` | 1 a muchos | Solo los de la versión vigente están `activo` |
| `Mensaje` → `AdjuntoMensaje` | 0 a muchos | Foto/video/doc entrante o saliente |
| `AdjuntoMensaje` → `Asset` | 1 | Mismo almacén; distinto propósito (`proposito = adjunto_canal`) |
| `Asset` → `ImportacionCatalogo` | 0..1 | Solo si el router eligió rama catálogo |

## 3. Enums de dominio (persistencia)

Valores en `snake_case` (alineados a API camelCase vía DTOs).

### 3.1 `TipoMaterial`

| Valor | MIME / extensiones típicas | Parser conceptual |
|---|---|---|
| `pdf` | `application/pdf` | Texto por página/sección |
| `docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Extracción DOCX |
| `xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | ExcelJS → bifurcación |
| `csv` | `text/csv` | Parser tabular → bifurcación |
| `imagen` | `image/jpeg`, `image/png`, `image/webp` | Vision (OCR + caption) |
| `video` | `video/mp4`, `video/quicktime`, `video/webm` | Whisper + frames Vision |

Allowlist cerrada: MIME fuera de lista → rechazo (`MIME_NO_PERMITIDO`).

### 3.2 `PipelineEstado`

| Valor | Significado |
|---|---|
| `pendiente` | Asset persistido; job aún no toma el trabajo |
| `procesando` | Parser / Vision / Whisper / embed en curso |
| `listo` | Derivados listos; si es K publicado, fragmentos activos recuperables |
| `parcial` | Parte del material indexada (p. ej. audio OK, frames fallidos); admin decide republicar |
| `error` | Fallo terminal o reintentos agotados; bot **no** consume |

El bot / hybrid search **solo** usa fragmentos de documentos con `pipeline_estado ∈ { listo }` (y opcionalmente política explícita para `parcial` — default v1: **no**).

### 3.3 `OrigenDerivacion`

| Valor | Origen del texto del fragmento |
|---|---|
| `texto_nativo` | Extracción directa PDF/DOCX (o texto plano) |
| `vision` | Caption / OCR de imagen o frame de video |
| `whisper` | Transcripción de audio de video |
| `xls_narrativo` | Celdas/hojas marcadas como FAQ o descripción larga (sin montos) |

### 3.4 `PropositoAsset` (discriminante)

| Valor | Uso |
|---|---|
| `conocimiento` | Biblioteca K / `DocumentoFuente` |
| `import_catalogo` | Entrada a `ImportacionCatalogo` |
| `adjunto_canal` | Media de mensajería ligada a `Mensaje` |

## 4. Entidad `Asset`

Binario versionable en object storage + metadatos de pipeline.

| Atributo | Tipo conceptual | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `proposito` | `PropositoAsset` | Discriminante |
| `tipo_material` | `TipoMaterial` | Router de parser |
| `mime_type` | string | MIME real detectado (no solo extensión) |
| `nombre_original` | string | Nombre de archivo para citas UI / `[Fuente: …]` |
| `storage_key` | string | Clave en bucket (obligatoria) |
| `storage_bucket` | string | Bucket / contenedor |
| `checksum` | string (sha256) | Integridad e idempotencia de re-upload |
| `bytes` | entero | Tamaño |
| `duracion_sec` | entero \| null | Solo video; tope v1 **300** (5 min) |
| `ancho_px` / `alto_px` | entero \| null | Imagen / frame de referencia |
| `pipeline_estado` | `PipelineEstado` | Estado del job |
| `pipeline_error_code` | string \| null | Ej. `PIPELINE_ERROR`, `VIDEO_DEMASIADO_LARGO` |
| `pipeline_error_detalle` | string \| null | Mensaje interno (no al lead) |
| `pipeline_progreso_pct` | 0..100 \| null | Para polling admin |
| `sede_id` | UUID \| null | Alcance opcional |
| `subido_por_usuario_id` | UUID \| null | Admin/coord; null si canal |
| `creado_en` / `actualizado_en` | timestamp | |

**Invariante storage:** sin `storage_key` válido no se acepta el upload (object storage **obligatorio** en todos los entornos fuera de unit test con `StoragePort` fake).

## 5. `DocumentoFuente` (extensión multimodal)

Conserva el rol de [01-modelo-conceptual.md](01-modelo-conceptual.md) §4.1 y añade vínculo al binario:

| Atributo añadido / aclarado | Descripción |
|---|---|
| `asset_id` | FK a `Asset` (`proposito = conocimiento`) |
| `tipo_material` | Denormalizado desde Asset (filtro listados) |
| `pipeline_estado` | Espejo / join del Asset para UI |
| `version` | Entero monotónico por línea documental |
| `estado` | `borrador` \| `publicado` \| `archivado` |
| `nombre_archivo_cita` | Copy estable para `[Fuente: …]` (suele = `nombre_original`) |

Ciclo: upload → borrador + `pipeline_estado` → (opcional) preview admin → **publicar** → job alta prioridad → `listo` + fragmentos activos → invalidar versión anterior.

## 6. `FragmentoVectorial` extendido

Pasaje indexable; siempre texto, aunque el origen sea media.

| Atributo | Descripción |
|---|---|
| `id` | UUID |
| `documento_fuente_id` | FK |
| `documento_version` | Entero alineado a la versión que lo generó |
| `texto` | Pasaje indexable (obligatorio) |
| `orden` | Orden estable dentro del documento |
| `embedding` | Vector (dimensión del modelo OpenAI fijado en env) |
| `tsv` | Representación FTS (`tsvector` o equivalente) |
| `activo` | Solo `true` para versión publicada vigente |
| `origen_derivacion` | `OrigenDerivacion` |
| `no_recuperable_precio` | boolean — ver §8 |
| `tipo_material` | Denormalizado para telemetría / filtros |
| `page_or_slide` | entero \| null (PDF página / slide) |
| `t_start_ms` / `t_end_ms` | entero \| null (segmento video/audio) |
| `frame_asset_id` | UUID \| null (frame auxiliar en storage, opcional) |
| `sede_id` / `tipo_documento` | Metadatos de filtro (heredados del documento) |
| `creado_en` | timestamp |

### 6.1 Índices conceptuales (Postgres + pgvector)

| Índice | Propósito |
|---|---|
| HNSW o IVFFlat sobre `embedding` | Rama semántica hybrid (`<=>` / cosine) |
| GIN sobre `tsv` (`to_tsvector`) | Rama FTS / nombres propios |
| B-tree compuesto `(activo, sede_id, tipo_documento)` | Filtros duros pre-retrieval |
| B-tree `(documento_fuente_id, documento_version, orden)` | Reconstrucción / invalidación |
| Parcial `WHERE activo = true AND no_recuperable_precio = false` (opcional) | Acelerar candidatos “seguros” para intents no-precio; el orquestador igual aplica gate lógico |
| B-tree `origen_derivacion` | Telemetría / depuración admin |

Reglas de retrieval: mismos filtros de [../backend/03-rag-avanzado.md](../backend/03-rag-avanzado.md) (publicado, sede, activo) **más** exclusión operativa de fragmentos cuyo documento no está `listo`.

## 7. `AdjuntoMensaje` (canal)

Media entrante/saliente en Facebook / Instagram / WhatsApp. **No** es entrada automática a la biblioteca K.

| Atributo | Descripción |
|---|---|
| `id` | UUID |
| `mensaje_id` | FK `Mensaje` |
| `asset_id` | FK `Asset` (`proposito = adjunto_canal`) |
| `direccion` | `entrante` \| `saliente` (denormalizado del mensaje) |
| `clasificacion_intent` | enum ligero opcional: `desconocido` \| `ambiente_sede` \| `posible_tarifa` \| `documento` \| `otro` |
| `resumen_interno` | Texto corto para expediente del asesor (no se envía al lead como “cotización”) |
| `indexado_en_biblioteca_k` | siempre `false` en v1 salvo acción admin explícita (fuera de alcance auto) |

Pipeline ligero (Fase canales):

1. Webhook descarga media → `Asset` + `AdjuntoMensaje`.
2. Vision/Whisper de clasificación (bajo costo) → `clasificacion_intent` + `resumen_interno`.
3. Si `posible_tarifa` e intent del turno es precio → orquestador usa **tools** o handoff; **nunca** monto desde OCR.
4. No crear `DocumentoFuente` ni `FragmentoVectorial` activos de biblioteca.

## 8. Invariantes anti-alucinación

1. **Montos / rangos / unidad monetaria:** únicamente filas `PaquetePrecio` publicadas y vigentes vía tools Prisma. Prohibido saturar respuesta de precio con texto de fragmento, OCR o Whisper.
2. **`no_recuperable_precio = true`:** el scrubber (tablas PDF, OCR con `$`/SKU/tarifa, celdas de hoja de precios filtradas por error) marca el pasaje. Ese fragmento:
   - puede existir para auditoría / “había una tabla aquí”;
   - **no** puede ser la evidencia que autorice un monto al lead;
   - si el intent es precio y solo hay este tipo de evidencia narrativa → forzar `ToolsCatalogModule` o handoff (`sin_catalogo` / `conflicto`).
3. **Un version publicado activo:** al publicar versión `n`, los fragmentos de `n-1` pasan a `activo = false` en el mismo corte lógico; hybrid no los ve.
4. **Object storage obligatorio:** fallar el upload si el put al bucket falla; no “guardar solo en DB”.
5. **Video &gt; 5 min:** rechazo en validación (`VIDEO_DEMASIADO_LARGO`); no encolar Whisper masivo.
6. **XLS/CSV de precios:** rama `ImportacionCatalogo` → Prisma; **prohibido** crear `FragmentoVectorial` desde columnas de monto ([02-catalogo-paquetes.md](02-catalogo-paquetes.md) §3).
7. **XLS narrativo:** solo hojas/columnas explícitamente narrativas (`descripcion_larga`, FAQ) con `origen_derivacion = xls_narrativo` y scrub de montos.
8. **Borrador / archivado / `pipeline_estado ≠ listo`:** no recuperable por el bot.
9. **Citas:** respuesta RAG exitosa cita `nombre_archivo_cita` del documento (incl. imagen/video derivados).
10. **Adjuntos de canal:** no cotizan; no publican a K.

## 9. Catálogo XLS vs narrativo (bifurcación)

```
Upload .xlsx / .csv
        │
        ▼
  ¿Propósito / clasificación de hojas?
        │
   ┌────┴────────────────────┐
   ▼                         ▼
import_catalogo          conocimiento (narrativo)
   │                         │
   ▼                         ▼
ImportacionCatalogo      DocumentoFuente + Asset
→ Paquete* / Precio*     → scrub → FragmentoVectorial
                         origen = xls_narrativo
   │                         │
   ▼                         ▼
Tools Prisma             Hybrid + Rerank
(montos)                 (prosa; sin montos)
```

| Señal | Destino |
|---|---|
| Hojas `Paquetes` / `Precios` / `Inclusiones` (contrato sandbox) | Catálogo |
| Flag admin `modoImportacion = catalogo` en multipart catálogo | Catálogo (`POST /catalogo/importaciones`) |
| Flag / tipo documental FAQ + hoja de texto | Narrativo K |
| Columna `descripcion_larga` junto a import de precios | Opcional K05 **sin** copiar columnas de monto |

Endpoint de conocimiento **no** debe mutar `PaquetePrecio`. Endpoint de catálogo **no** debe crear fragmentos de montos.

## 10. Relación con `RegistroRecuperacion`

Además de lo definido en el modelo base, el registro guarda trazas multimodales:

- `tipo_material` de los fragmentos finales (o lista por candidato).
- `origen_derivacion` por fragmento usado.
- Flags si algún candidato tenía `no_recuperable_precio`.
- IDs de `Asset` / nombre de archivo de cita.

Shape wire: [../backend/05-dtos-y-tipos.md](../backend/05-dtos-y-tipos.md) (`RegistroRecuperacionDto` extendido).

## 11. SLAs de pipeline (persistidos vía estado)

| Material | Objetivo a `listo` | Nota |
|---|---|---|
| PDF / DOCX / XLS narrativo | &lt; 60 s | Paridad C4 texto |
| XLS catálogo | Post-commit tools | Sin embed de montos |
| Imagen | &lt; 90 s | Vision + embed |
| Video ≤ 5 min | &lt; 5 min | Async; UI polling |

Estados intermedios (`pendiente` / `procesando`) son visibles al admin; el bot ignora hasta `listo` + `publicado`.

## 12. Qué no modela este entregable

- CDN público de media al prospecto desde la biblioteca K (v1: respuesta texto + cita).
- Auto-promoción de adjuntos de canal a documentos publicados.
- Embeddings multimodales nativos imagen↔imagen (solo texto derivado).
- Transcripción en tiempo real de llamadas de voz.
- Almacenamiento indefinido de frames a máxima resolución sin política de retención (definir retención en infra).

## 13. Criterio de cierre

Quedan fijados: ER `Asset` ↔ `DocumentoFuente` ↔ `FragmentoVectorial` extendido ↔ `AdjuntoMensaje`, enums `TipoMaterial` / `PipelineEstado` / `OrigenDerivacion`, índices vector+GIN, invariantes anti-alucinación (montos, versión única, storage obligatorio, flag `no_recuperable_precio`), bifurcación XLS catálogo vs narrativo, y SLAs por tipo de material.
