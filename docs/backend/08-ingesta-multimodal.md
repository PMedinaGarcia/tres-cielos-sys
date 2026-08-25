# Ingesta multimodal — MediaRouter, parsers, SLAs y storage

Cómo entran **PDF, Word, Excel, fotos y videos** al sistema: enrutado por MIME, parseo, scrub de tarifas, object storage obligatorio, estados de pipeline, distinción **adjunto de canal** vs **biblioteca K**, allowlist y límites.

Complementa: [04-ingesta-conocimiento.md](04-ingesta-conocimiento.md) (ciclo publicar/archivar e inventario K), [07-pipeline-openai-y-proveedores.md](07-pipeline-openai-y-proveedores.md) (Vision/Whisper/OpenAI), [03-rag-avanzado.md](03-rag-avanzado.md) (consumo de fragmentos derivados).

## 1. Objetivo

- Aceptar material autorizado (biblioteca) y adjuntos entrantes de canal con **reglas explícitas**.
- Convertir media a **texto derivado** indexable (o a catálogo Prisma si es XLS de precios).
- **Nunca** cotizar montos desde OCR, Vision, Whisper ni fragmentos marcados `no_recuperable_precio`.
- Cumplir SLAs diferenciados: texto &lt; 60 s, foto &lt; 90 s, video &lt; 5 min.
- Conservar binarios en **object storage** (obligatorio); Postgres guarda metadatos + texto/fragmentos.

## 2. Dos orígenes de media (no confundir)

| Origen | Quién sube | Destino típico | Indexación RAG | Visible al lead como “fuente K” |
|---|---|---|---|---|
| **Biblioteca K** | Admin / Medina (panel Conocimiento) | `DocumentoFuente` versionado → fragmentos | Sí, si publicado | Sí (`[Fuente: …]` + tipo material) |
| **Adjunto de canal** | Prospecto (Meta/WhatsApp) o asesor en hilo | `Mensaje` + objeto storage; job de extracción | **No** a biblioteca K por defecto | No como K01–K10; puede informar el turno o escalar |

### 2.1 Reglas de adjunto de canal

1. El webhook **ack** rápido; el parseo pesado es **asíncrono** (cola).
2. Mientras el job corre, el bot puede: (a) mensaje de espera breve aprobado, o (b) continuar guion si el adjunto no es bloqueante.
3. Texto derivado del adjunto **no** se publica solo a la biblioteca K.
4. Si el adjunto parece tarifa/lista de precios → scrub + **no cotizar**; si el lead pregunta precio → tools Prisma o handoff.
5. Video &gt; 5 min o MIME fuera de allowlist → rechazo tipificado + safe/handoff (`adjunto_no_soportado`).

### 2.2 Reglas de biblioteca K

1. Solo roles admin (y flujo de aprobación Tres Cielos) publican.
2. Publicar dispara job de prioridad según tipo de material (§6).
3. Invalidación de versión anterior igual que documentos texto ([04-ingesta-conocimiento.md](04-ingesta-conocimiento.md) §5).
4. Cita al lead usa nombre de archivo / título **y** tipo de material (foto, video, pdf, …) — ver orquestador.

## 3. Object storage (obligatorio)

Con multimodal activo:

| Requisito | Detalle |
|---|---|
| Binario canónico | Siempre en bucket del entorno (`put` al recibir upload o al bajar media del canal) |
| DB | `storage_key`, `mime`, `bytes`, `checksum`, `duracion_ms` (video/audio), estado pipeline |
| Acceso | URLs **firmadas** de corta vida para Vision/Whisper/worker; no buckets públicos abiertos |
| Retención | Alineada a política de datos; al archivar documento K se puede soft-delete o lifecycle rule |
| Separación | Bucket o prefijo distinto por entorno (dev / staging / prod) |

Variables: [07-pipeline-openai-y-proveedores.md](07-pipeline-openai-y-proveedores.md) §4.3.

## 4. MediaRouter — enrutado por MIME

Componente conceptual del `KnowledgeIngestionModule` (y del path de adjuntos en `ChannelsModule`):

```
Archivo recibido (upload panel o media URL de canal)
        ↓
Validar allowlist MIME + tamaño + duración
        ↓
put → ObjectStorage  →  persistir metadatos
        ↓
MediaRouter.route(mime, origen)
        ├─ application/pdf              → PdfParser
        ├─ Word (doc/docx)              → WordParser
        ├─ Excel/CSV                    → XlsRouter (catálogo vs narrativa)
        ├─ image/* (allowlist)          → PhotoPipeline (Vision)
        ├─ video/* (allowlist)          → VideoPipeline (demux + Whisper)
        └─ otro                         → Rechazo tipificado
        ↓
ScrubTarifas / flags
        ↓
Chunk + embed + FTS  (si destino = biblioteca publicada)
   o  texto de turno / handoff (si destino = adjunto canal)
```

### 4.1 Allowlist MIME (v1)

| Familia | MIME aceptados (ejemplos) | Parser |
|---|---|---|
| PDF | `application/pdf` | PdfParser |
| Word | `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/msword` | WordParser |
| Excel / CSV | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`, `text/csv` | XlsRouter |
| Foto | `image/jpeg`, `image/png`, `image/webp` | PhotoPipeline |
| Video | `video/mp4`, `video/quicktime` | VideoPipeline |

Fuera de lista → no encolar Vision/Whisper; responder rechazo controlado.

### 4.2 Límites duros

| Límite | Valor de producto v1 | Acción si se excede |
|---|---|---|
| Tamaño PDF/Word | p. ej. 25 MB | Rechazo `archivo_demasiado_grande` |
| Tamaño Excel | p. ej. 15 MB | Idem |
| Tamaño foto | p. ej. 10 MB | Idem |
| Tamaño video | p. ej. 100 MB | Idem |
| **Duración video** | **≤ 5 minutos** | Rechazo `video_excede_duracion` |
| Páginas PDF (orientativo) | tope configurable (p. ej. 50) | Truncar con warning admin o rechazo |
| Resolución foto | max edge configurable | Resize en worker antes de Vision |

Los números exactos de MB se fijan en env (`MEDIA_MAX_*`); la **duración de video ≤ 5 min** es regla de producto, no solo config.

## 5. Parsers por tipo

### 5.1 PDF (`PdfParser`)

1. Intentar extracción de texto nativo (por página/sección).
2. Si página sin texto útil (escaneada) → rasterizar página → `VisionPort` (OCR/descripción controlada).
3. Detectar tablas / bloques que parezcan **tarifas** (patrones `$`, `MXN`, columnas “precio”, “anticipo”, etc.).
4. Esas secciones: **excluir** del índice **o** indexar solo con flag `no_recuperable_precio = true` (preferencia: excluir montos; si queda prosa útil alrededor, fragmentar prosa sin números de tarifa).
5. Chunk semántico + embedding + `tsvector`.
6. Metadatos: `tipo_material = pdf`, `documento_id`, `version`, `sede`, `nombre_archivo`.

### 5.2 Word (`WordParser`)

1. Extraer cuerpo y headings.
2. Mismo scrub de tarifas que PDF.
3. No tratar comentarios internos / control de cambios como fuente publicada (strip).
4. Chunk + embed + FTS.

### 5.3 Excel / CSV (`XlsRouter`)

| Contenido detectado | Destino |
|---|---|
| Paquetes, precios, inclusiones, reglas | `ImportacionCatalogo` → Prisma ([../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md)) |
| Hoja FAQ / prosa sin montos | `DocumentoFuente` narrativo |
| Columna “descripción larga” junto a precios | Narrativa **sin** montos (K05); montos solo catálogo |
| Hoja mixta ambigua | Job `requiere_revision_admin`; no publicar solo |

**Nunca** chunk de hoja de precios completa a pgvector como verdad de montos.

### 5.4 Foto (`PhotoPipeline`)

1. Validar MIME/tamaño → storage.
2. Opcional: resize / strip EXIF sensible.
3. `VisionPort.describeOrExtractText` con prompt de producto: describir venue/ambiente/texto visible; **no** inventar precios; si hay montos visibles, listarlos solo para **marcar scrub**, no para cotizar.
4. Salida: `texto_derivado` + `no_recuperable_precio` si hubo tarifas OCR.
5. Si origen = biblioteca K y publicación: chunk del texto derivado (pasajes narrativos) + embed + FTS; `tipo_material = foto`.
6. Si origen = canal: adjuntar texto al contexto del turno / expediente; no auto-publicar.

### 5.5 Video (`VideoPipeline`)

1. Validar duración **≤ 5 min** y MIME.
2. Extraer pista de audio (worker) → `TranscriptionPort` (Whisper).
3. Opcional v1.1: frames clave → Vision para descripción de escena (no bloquea go-live si solo hay Whisper).
4. Scrub de tarifas en transcripción (mismo detector).
5. Texto derivado → fragmentos si biblioteca; si canal → contexto de turno.
6. `tipo_material = video`; guardar `duracion_ms`.

## 6. Scrub de tarifas y flag `no_recuperable_precio`

### 6.1 Detector (heurística + reglas)

Señales (combinables):

- Tokens monetarios: `$`, `MXN`, `USD`, “precio”, “anticipo”, “costo”, “tarifa”, “paquete desde”.
- Tablas con columnas numéricas alineadas a moneda.
- Salida explícita de Vision: “se observa lista de precios…”.

### 6.2 Efectos del flag

| Situación | Efecto |
|---|---|
| Fragmento con `no_recuperable_precio = true` | Entra a hybrid **solo** si aporta prosa no monetaria; el orquestador **ignora** cualquier monto en ese texto |
| Gate de cotización | Si la intención es precio/paquete → **siempre** tools Prisma; si solo hay material OCR de tarifas → safe + handoff o tools, **nunca** cifra desde fragmento |
| Registro | `RegistroRecuperacion` / telemetría pueden marcar `fragmentos_con_flag_precio` |

Detalle de routing: [02-orquestador-agentico.md](02-orquestador-agentico.md) §4.5.

## 7. Estados del pipeline de media

Estados observables en panel (job) y en metadatos del objeto:

| Estado | Significado |
|---|---|
| `recibido` | Metadatos + storage OK; aún no parseado |
| `en_cola` | Job encolado |
| `extrayendo` | Parser / Vision / Whisper en curso |
| `scrub` | Post-proceso de tarifas |
| `indexando` | Chunk + embed + FTS (solo biblioteca) |
| `listo` | Consumible (publicado + searchable, o texto de turno listo) |
| `error` | Fallo tipificado; reintento o intervención admin |
| `rechazado` | Allowlist / tamaño / duración; no reintenta solo |

Transiciones:

```
recibido → en_cola → extrayendo → scrub → [indexando] → listo
                              ↘ error (reintento limitado) ↗
         → rechazado (terminal hasta nuevo upload)
```

Emitir `EventoOperativo` / auditoría en `listo`, `error`, `rechazado` para biblioteca K.

## 8. SLAs diferenciados

Medidos desde el evento disparador hasta estado `listo` (biblioteca: searchable; canal: texto disponible al orquestador).

| Tipo de material | Disparador | SLA producto | Alerta si se excede |
|---|---|---|---|
| **Texto** (PDF/Word texto-nativo, FAQ) | Publicar documento | **&lt; 60 s** | Cola atrasada / worker |
| **Foto** | Publicar o adjunto canal encolado | **&lt; 90 s** | Idem + Vision |
| **Video** (≤ 5 min) | Publicar o adjunto canal | **&lt; 5 min** | Whisper / demux |
| Precio catálogo (XLS → Prisma) | Commit publicado | Inmediato post-commit | N/A embeddings |

Notas:

- El SLA de frescura narrativa clásica (&lt; 60 s) de [04-ingesta-conocimiento.md](04-ingesta-conocimiento.md) sigue válido para **texto**.
- Foto y video tienen presupuesto mayor; UAT debe medir p95 por tipo.
- Webhook de canal no espera el SLA completo: ack + job.

### 8.1 Prioridad de cola

| Evento | Prioridad |
|---|---|
| `documento.publicado` texto | Alta |
| `documento.publicado` foto | Alta |
| `documento.publicado` video | Media-alta (slot worker; no bloquear texto) |
| Adjunto canal | Media (por hilo; no tumbar publicación K) |
| Reindex masivo | Baja |

## 9. Citas y tipo de material

Cuando un fragmento derivado alimenta RAG y la respuesta es exitosa:

```
[Fuente: nombre_archivo | tipo: foto]
[Fuente: ficha-jardin-1.pdf | tipo: pdf]
[Fuente: recorrido-salon.mp4 | tipo: video]
```

El generador recibe `nombre_archivo` + `tipo_material` en metadatos del fragmento. Validación post-hoc: presencia de cita; si falta → handoff.

## 10. Seguridad y privacidad

- No indexar credenciales, documentos legales fuera de K, ni datos personales de terceros en videos de eventos reales sin base legal/aprobación.
- Preferir strip de metadatos EXIF (GPS) en fotos de biblioteca.
- Adjuntos de canal: acceso RBAC en expediente; URLs firmadas.
- Virus/malware: scan opcional en worker antes de parsear (recomendado staging/prod).

## 11. UAT multimodal (mínimo)

| # | Caso | Esperado |
|---|---|---|
| 1 | Publicar PDF texto K02 | Searchable &lt; 60 s; cita tipo pdf |
| 2 | Publicar foto de salón (sin precios) | Searchable &lt; 90 s; cita tipo foto; prosa usable en FAQ de ambiente |
| 3 | Foto con cartel de precios | Flag `no_recuperable_precio`; pregunta “cuánto cuesta” → tools/handoff, **no** monto OCR |
| 4 | Video 3 min tour | Transcripción + listo &lt; 5 min |
| 5 | Video 6 min | `rechazado` / `video_excede_duracion` |
| 6 | MIME `.exe` / raro | `rechazado` allowlist |
| 7 | XLS precios | Filas Prisma; **cero** fragmentos de monto |
| 8 | Adjunto canal WhatsApp (foto) | No aparece como K publicado; texto en turno o handoff |

## 12. Criterios de cierre de este entregable

| # | Criterio |
|---|---|
| 1 | MediaRouter por MIME documentado con allowlist y límites (video ≤ 5 min) |
| 2 | Parsers PDF/Word/XLS/foto/video + scrub y `no_recuperable_precio` |
| 3 | Object storage obligatorio; estados de pipeline definidos |
| 4 | Separación adjunto canal vs biblioteca K |
| 5 | SLAs texto &lt; 60 s, foto &lt; 90 s, video &lt; 5 min |
| 6 | Casos UAT §11 listos para checklist de go-live |

## 13. Relación con otros docs

| Doc | Uso |
|---|---|
| [04-ingesta-conocimiento.md](04-ingesta-conocimiento.md) | Inventario K, publicación, frescura texto; **apunta aquí** para media |
| [07-pipeline-openai-y-proveedores.md](07-pipeline-openai-y-proveedores.md) | Vision, Whisper, storage env |
| [03-rag-avanzado.md](03-rag-avanzado.md) | Fragmentos derivados en hybrid + Cohere |
| [02-orquestador-agentico.md](02-orquestador-agentico.md) | Gate precio + adjuntos entrantes |
