# Aceptación multimodal y matriz de tests — conocimiento / media

Contrato de **aceptación automatizable y UAT** para la ingesta multimodal del Agentic RAG (PDF, Word, Excel split, foto, video, adjunto de lead) y para los ports de proveedores (OpenAI + Cohere + storage).

**Alcance:** documentación de criterios y suites. Las rutas de archivo bajo `apps/` y `fixtures/` son **objetivo** (pueden no existir aún en el repo).

**No duplica:** criterios de producto C1–C7 ([../producto/03-criterios-exito-cotizacion.md](../producto/03-criterios-exito-cotizacion.md)), dominio D-BOT / D-KNW en [../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md), ni el pipeline narrativo de [03-rag-avanzado.md](03-rag-avanzado.md) / [04-ingesta-conocimiento.md](04-ingesta-conocimiento.md). Aquí se **especializan** MIME, OCR, storage, parsers y la matriz ID → test.

**Referencias cruzadas obligatorias**

| ID / tema | Fuente |
|---|---|
| C3 = 0 montos inventados | producto/03; D-BOT-2; §5.3 setup/04 |
| C5 rerank ≥ **0.85** | producto/03; D-BOT-3/4; RAG §4 |
| C4 frescura &lt; **60 s** | producto/03; D-KNW-2; ingesta §5 |
| D-KNW-* / D-MED-* (producto) | [../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md) §3.8–3.8b |
| Object storage + secretos | [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md); [../github/04-entornos-secretos-gobierno.md](../github/04-entornos-secretos-gobierno.md) |
| UI conocimiento | [../frontend/00-superficies.md](../frontend/00-superficies.md); UI-KNW-* abajo |

---

## 1. Principios de aceptación multimodal

1. **Separación duro/narrativo:** montos y SKUs → catálogo Prisma (tools); narrativa → vector + FTS. Excel de precios **nunca** se chunk-ea a pgvector como fuente de montos (C3).
2. **Tariff / OCR gate:** texto OCR o Vision que parezca tarifa/precio se **excluye o marca** `no_recuperable_precio`; el orquestador debe ir a tools, no al LLM narrativo.
3. **MIME allowlist:** rechazo temprano (422) de tipos no soportados; no confiar solo en extensión de archivo.
4. **Storage obligatorio:** todo binario fuente (conocimiento o adjunto lead) vive en object storage vía `StoragePort`; DB guarda metadatos + key, no el blob.
5. **Ports mockeables:** en CI unit/integration los adapters OpenAI/Cohere/S3/ffmpeg están detrás de ports; `@live` solo en staging.
6. **Frescura C4:** publicar/archivar sigue el SLA &lt; 60 s de D-KNW-2 también para media que produce fragmentos.

---

## 2. Criterios D-MED-* (media / MIME / pipeline)

Familia de dominio **Media & Document Pipeline**. Complementa D-KNW (ciclo de vida documental) sin reemplazarlo.

| ID | Criterio | Umbral / regla | Evidencia |
|---|---|---|---|
| D-MED-1 | Allowlist MIME de conocimiento: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx), `application/msword` (doc legacy opcional v1), `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` / `text/csv`, `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/quicktime` | MIME no listado → **422** `UNSUPPORTED_MIME` | T-MED-MIME + UAT |
| D-MED-2 | Detección MIME por magic bytes / `file-type` (o equivalente); no solo `Content-Type` del client | Spoof extensión → rechazo o reclasificación segura | Unit + integration |
| D-MED-3 | Todo upload escribe objeto vía `StoragePort.put`; respuesta API incluye `storageKey` opaco (no URL firmada larga en logs) | 100 % uploads OK | Integration storage |
| D-MED-4 | Pipeline de job: `recibido` → `parseando` → `chunking` → `embebiendo` → `listo` \| `error`; estados visibles en panel | Transiciones auditables | Job + UI-KNW |
| D-MED-5 | Parser PDF: texto por página/sección; tablas con patrón tarifa → scrub / `no_recuperable_precio` | 0 montos indexados como recuperables de precio | T-MED-PDF + scrub branch ≥80 % |
| D-MED-6 | Parser Word (docx): headings → chunks; mismas reglas de scrub de montos que PDF | Idem | T-MED-DOCX |
| D-MED-7 | Excel/CSV **split**: hoja precios/inclusiones → `ImportacionCatalogo`; hoja FAQ/narrativa → `DocumentoFuente` sin columnas de monto | Nunca chunk de hoja de precios a pgvector | T-MED-XLS; alinea sandbox/08 |
| D-MED-8 | Foto (jpeg/png/webp): `VisionPort` extrae texto/descripción; si detecta tarifa → gate OCR (D-MED-10); si narrativa autorizada → chunk con meta `origen=vision` | Sin Vision en CI (mock) | T-MED-IMG |
| D-MED-9 | Video (mp4/mov): worker extrae audio (ffmpeg) → `TranscriptionPort` → texto; frames clave opcionales vía Vision solo si política lo habilita | Worker con binario ffmpeg documentado en infra | T-MED-VID |
| D-MED-10 | **OCR / tariff gate:** si regex/classifier de tarifa (montos `$`, `MXN`, “precio por persona”, tablas $) → fragmentos marcados no recuperables para precio; orquestador no usa esos chunks para responder montos (C3) | 100 % casos golden tariff | T-MED-OCR + coverage branches scrub |
| D-MED-11 | Adjunto entrante de lead (Meta/WA imagen/doc): mismo pipeline MIME; no publica a biblioteca K automáticamente; queda ligado a conversación/oportunidad | Scope lead ≠ conocimiento global | T-MED-LEAD + UAT adjunto |
| D-MED-12 | Límite tamaño por MIME (orientativo v1): PDF/Word ≤ 25 MB; XLS ≤ 10 MB; imagen ≤ 8 MB; video ≤ 100 MB — configurable por env | Exceso → 413 / `PAYLOAD_TOO_LARGE` | Contract + config |
| D-MED-13 | Fallo proveedor Vision/Transcription/LLM en ingesta → job `error` + alerta admin; **no** publicar versión a medias searchable | Sin fragmentos huérfanos activos | NF-R-2 + T-MED-FAIL |
| D-MED-14 | Invalidación C4: tras `listo`, versión anterior inactiva; bot refleja contenido nuevo en &lt; 60 s | C4 / D-KNW-2 | UAT frescura media |

### 2.1 Relación D-MED ↔ C3 / C5 / C4 / D-BOT

| Producto | Cómo lo toca media |
|---|---|
| **C3** | Scrub + split XLS + gate OCR; montos solo tools Prisma (D-BOT-2) |
| **C5** | Fragmentos de foto/video/PDF pasan el mismo rerank ≥ 0.85 (D-BOT-3/4) |
| **C4** | Job media cuenta para SLA publicar → `listo` (D-KNW-2, D-MED-14) |
| **D-BOT-1** | Routing no cambia: precio nunca “porque el PDF lo decía” |

---

## 3. Criterios UI-KNW-* (panel conocimiento)

Criterios de superficie `/conocimiento` alineados a [../frontend/00-superficies.md](../frontend/00-superficies.md) y RBAC [06-guards-y-rbac.md](06-guards-y-rbac.md). Complementan la fila “Conocimiento” de setup/04 §4.2.

| ID | Criterio | Roles | Evidencia |
|---|---|---|---|
| UI-KNW-1 | Upload multipart con progress (bytes o %); cancelar upload aborta request y no deja job huérfano | Admin (write) | E2E / Playwright objetivo |
| UI-KNW-2 | Tras upload: fila documento en `borrador` + MIME icon + tamaño; CTA Publicar solo si parse preview OK o admin fuerza | Admin | UAT 3.6 + smoke |
| UI-KNW-3 | Progress de job: estados D-MED-4 en UI; &gt; 60 s o `error` → aviso actionable (D-KNW-6) | Admin | Poll/realtime |
| UI-KNW-4 | Asesor: sin ruta write; deep link `/conocimiento` → 403 producto o redirect | Asesor | F1 + gate UI |
| UI-KNW-5 | Coordinador: default sin publicar; si pacto borradores → solo lectura/borrador sin `publicar` API (403) | Coord | Matriz RBAC |
| UI-KNW-6 | Preview anti-tarifa: si el pipeline marcó scrub, UI muestra badge “Tarifas excluidas del índice” antes de publicar | Admin | Caso foto/PDF tarifa |
| UI-KNW-7 | Tipos no soportados: mensaje ES claro (`UNSUPPORTED_MIME`) sin stack trace | Admin | UI-X-3 |
| UI-KNW-8 | Lista filtra por estado (`borrador` / `publicado` / `archivado` / `error`) y por MIME group (doc / hoja / imagen / video) | Admin | Smoke |

---

## 4. Suites automatizadas T-MED-* (por parser)

Convención: prefijo **T-MED** = test suite media. Cada suite debe ser ejecutable con providers **mock** en CI.

| Suite ID | Parser / foco | Debe demostrar | Tags |
|---|---|---|---|
| T-MED-MIME | Allowlist + magic bytes | D-MED-1, D-MED-2, D-MED-12 | `unit` `contract` |
| T-MED-PDF | PDF texto + scrub tablas $ | D-MED-5; 0 montos recuperables precio | `unit` `integration` |
| T-MED-DOCX | Word headings/chunks + scrub | D-MED-6 | `unit` `integration` |
| T-MED-XLS | Split catálogo vs narrativa | D-MED-7; C3; alinea `sandbox:eval` | `integration` |
| T-MED-IMG | Vision mock → chunks / tariff gate | D-MED-8, D-MED-10 | `unit` `integration` |
| T-MED-VID | ffmpeg stub + Transcription mock | D-MED-9 | `integration` (skip si no ffmpeg en CI → job marcado) |
| T-MED-OCR | Golden tariffs (foto + PDF escaneado) | D-MED-10; branches scrub ≥ 80 % | `unit` |
| T-MED-LEAD | Adjunto lead no publica K global | D-MED-11 | `integration` |
| T-MED-STOR | StoragePort put/get/delete + key opaca | D-MED-3 | `integration` |
| T-MED-PIPE | Máquina estados job + rollback error | D-MED-4, D-MED-13 | `integration` |
| T-MED-FRESH | Publish media → pregunta bot &lt; 60 s | D-MED-14, C4 | `@live` staging |
| T-MED-FAIL | Vision/Transcription/S3 down → `error` actionable | D-MED-13, NF-R-1/2 | `integration` chaos mock |
| T-MED-RBAC | POST conocimiento 403 asesor | UI-KNW-4/5, F1 | `integration` API |

### 4.1 Casos golden mínimos por suite

| Suite | Caso | Esperado |
|---|---|---|
| T-MED-PDF | `faq-sin-precios.pdf` | Chunks indexables; citas con nombre archivo |
| T-MED-PDF | `lista-precios-tabla.pdf` | Filas $ → scrub; 0 fragmentos precio activos |
| T-MED-DOCX | `k02-ficha.docx` | Headings → chunks; metadatos sede |
| T-MED-XLS | `catalog-precios.xlsx` | Solo Prisma/import; 0 vectores de monto |
| T-MED-XLS | `faq-hoja-texto.xlsx` | Puede crear DocumentoFuente FAQ sin montos |
| T-MED-IMG | `horario-visitas.jpg` | Texto/desc → chunk narrativo |
| T-MED-IMG | `tarjeta-precios.jpg` | OCR gate → no_recuperable_precio |
| T-MED-VID | `bienvenida-30s.mp4` | Transcript → chunk; job listo |
| T-MED-LEAD | Imagen WA en hilo | Adjunto en conversación; biblioteca K sin cambio |
| T-MED-OCR | Fixtures `tariff-*.{pdf,jpg}` | Classifier + scrub deterministic |

---

## 5. Pirámide de pruebas (media + anti-alucinación)

Extiende setup/04 §8.1 con foco multimodal.

```
        /\
       /E2E\      UAT scripted + Playwright conocimiento (UI-KNW)
      /------\
     /Contract\   MIME envelopes, error codes, Zod upload DTOs
    /----------\
   /Integration \ Jobs, Storage, parsers con fixtures, RBAC API
  /--------------\
 /     Unit       \ Scrub/tariff, MIME detect, split XLS, ports fake
/------------------\
```

| Capa | Qué cubrir (media) | Dónde corre | Providers |
|---|---|---|---|
| **Unit** | MIME detect, tariff regex/classifier, scrub branches, split sheet router, state machine pura | CI en todo PR | Fake in-memory |
| **Integration** | Parser+DB+job con fixtures; Storage MinIO/LocalStack o fake FS; API upload | CI | Mock ports OpenAI/Cohere |
| **Contract** | `UNSUPPORTED_MIME`, `PAYLOAD_TOO_LARGE`, shapes job DTO | CI | N/A |
| **E2E** | Upload UI → progress → publicar → bot cita (staging) | Nightly / manual gate | Reales o staging keys |
| **@live** | Vision/Transcription/Rerank/Embeddings reales | Staging only, workflow `workflow_dispatch` o label | OpenAI + Cohere + S3 |

### 5.1 Coverage objetivo

| Señal | Umbral | Alcance |
|---|---|---|
| Líneas — módulos críticos media (parsers, job pipeline, MIME, storage adapter iface) | ≥ **70 %** | Igual espíritu setup/04 §8.2 |
| Branches — **anti-alucinación + scrub/tariff gate** (D-MED-5/6/10, C3 paths) | ≥ **80 %** | Obligatoria para merge si el PR toca scrub/OCR |
| Branches — handoff rerank (ya D-BOT) | ≥ **80 %** | C5; no relajar por media |

---

## 6. Mapa ID → archivo de test sugerido

Rutas **objetivo** bajo el monorepo (ajustar si el scaffold usa otra convención).

| ID | Archivo sugerido |
|---|---|
| D-MED-1, D-MED-2, T-MED-MIME | `apps/api/src/modules/knowledge-ingestion/mime/mime-allowlist.spec.ts` |
| D-MED-3, T-MED-STOR | `apps/api/src/modules/storage/storage.port.integration.spec.ts` |
| D-MED-4, T-MED-PIPE | `apps/api/src/modules/knowledge-ingestion/jobs/ingestion-state-machine.spec.ts` |
| D-MED-5, T-MED-PDF | `apps/api/src/modules/knowledge-ingestion/parsers/pdf.parser.spec.ts` |
| D-MED-6, T-MED-DOCX | `apps/api/src/modules/knowledge-ingestion/parsers/docx.parser.spec.ts` |
| D-MED-7, T-MED-XLS | `apps/api/src/modules/knowledge-ingestion/parsers/spreadsheet.split.spec.ts` |
| D-MED-8, T-MED-IMG | `apps/api/src/modules/knowledge-ingestion/parsers/image.vision.spec.ts` |
| D-MED-9, T-MED-VID | `apps/api/src/modules/knowledge-ingestion/parsers/video.transcription.spec.ts` |
| D-MED-10, T-MED-OCR | `apps/api/src/modules/knowledge-ingestion/scrub/tariff-gate.spec.ts` |
| D-MED-11, T-MED-LEAD | `apps/api/src/modules/channels/attachments/lead-attachment.integration.spec.ts` |
| D-MED-12 | `apps/api/src/modules/knowledge-ingestion/mime/payload-limits.contract.spec.ts` |
| D-MED-13, T-MED-FAIL | `apps/api/src/modules/knowledge-ingestion/jobs/ingestion-failure.integration.spec.ts` |
| D-MED-14, T-MED-FRESH | `apps/api/test/live/freshness-media.live.spec.ts` (`@live`) |
| UI-KNW-1..3, UI-KNW-6..8 | `apps/web/e2e/conocimiento-upload.spec.ts` |
| UI-KNW-4..5, T-MED-RBAC | `apps/api/src/modules/conocimiento/conocimiento.rbac.integration.spec.ts` |
| C3 + scrub regresión | `apps/api/src/modules/orchestrator/anti-hallucination.catalog.spec.ts` |
| C5 rerank | `apps/api/src/modules/rag/rerank-threshold.spec.ts` |
| D-BOT-2 | `apps/api/src/modules/catalog/tools-precio.spec.ts` |
| Ports fake | `apps/api/src/ports/__fakes__/*.ts` + specs que los inyectan |

---

## 7. Ports de proveedores (contrato de aceptación)

Arquitectura hexagonal mínima: dominio de ingesta/orquestador depende de **ports**; adapters OpenAI/Cohere/S3/ffmpeg son reemplazables.

| Port | Responsabilidad | Adapter default (prod) | Fake CI | Criterio de aceptación |
|---|---|---|---|---|
| **LlmPort** | Generación / rewrite / orquestación de texto | OpenAI (chat) | Respuestas fixture por prompt hash | Fallo → safe/handoff (NF-R-1); **nunca** inventar precio |
| **EmbeddingsPort** | Vector de query y de chunk | OpenAI embeddings | Vector determinista por hash texto | Dimensión fija por entorno; mismatch → fail job |
| **RerankPort** | Score pregunta↔pasajes | Cohere Rerank | Scores table-driven | Umbral **0.85** (C5); &lt; umbral → handoff |
| **VisionPort** | Imagen → texto/descripción estructurada | OpenAI Vision | OCR/texto golden por fixture name | Tariff flag opcional en resultado |
| **TranscriptionPort** | Audio → texto | OpenAI Whisper (u OpenAI audio) | Transcript golden | Vacío → job error o skip chunk según política |
| **StoragePort** | `put` / `getSignedUrl` / `delete` / `exists` | S3-compatible (Railway bucket / AWS S3 / R2) | FS temp o MemoryStorage | D-MED-3; sin credenciales en repo |

### 7.1 Reglas de inyección

- Nest: providers tokenizados (`LLM_PORT`, `EMBEDDINGS_PORT`, …).
- CI unit: **solo fakes**.
- CI integration: fakes o LocalStack/MinIO para Storage; **no** llamar OpenAI/Cohere en PR por defecto.
- Staging `@live`: adapters reales; secretos desde Environment GitHub / PaaS ([../github/04-entornos-secretos-gobierno.md](../github/04-entornos-secretos-gobierno.md)).

### 7.2 Secretos asociados (nombres)

| Port | Secretos / vars |
|---|---|
| LlmPort / EmbeddingsPort / VisionPort / TranscriptionPort | `OPENAI_API_KEY` (o `LLM_API_KEY` + keys dedicadas si se separan proyectos) |
| RerankPort | `COHERE_API_KEY`, `RERANK_THRESHOLD=0.85` |
| StoragePort | `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_ENDPOINT` (si compatible) |
| Video worker | `FFMPEG_PATH` (opcional); imagen worker **debe** incluir binario ffmpeg |

---

## 8. CI vs `@live` staging

| Aspecto | CI (PR → main) | `@live` staging |
|---|---|---|
| Trigger | push/PR | `workflow_dispatch`, label `live-media`, o nightly |
| OpenAI / Cohere | **Prohibido** (mock ports) | Permitido con keys staging |
| S3 | Fake o MinIO en Compose service | Bucket staging real |
| ffmpeg | Opcional; T-MED-VID puede `skip` con mensaje si binario ausente | Obligatorio en imagen worker |
| Suites | T-MED-* sin tag `@live`; F1/C3 unit | T-MED-FRESH, smoke Vision/Whisper real |
| Gate merge | lint + typecheck + unit + integration + coverage umbrales §5.1 | No bloquea merge; **bloquea go-live** media (G8/G9 + UAT) |
| Costo | $0 providers | Contabilizar tokens; cupo staging separado |

Marca sugerida en código: `describe.skip` condicional o grep tag `@live` excluido del job `test` default ([../github/03-actions-ci-cd.md](../github/03-actions-ci-cd.md)).

---

## 9. Casos UAT por MIME

Ejecutar en staging con acta (§11 setup/04). Owner: QA Medina + aprobador Tres Cielos.

| # | MIME / escenario | Pasos | Esperado | IDs |
|---|---|---|---|---|
| U-MED-1 | **PDF** narrativo (K01) | Subir → publicar → preguntar FAQ en &lt; 60 s | Cita fuente; `RegistroRecuperacion`; rerank ≥ 0.85 | D-MED-5, C4, C5, D-KNW-2 |
| U-MED-2 | **PDF** con tabla de precios | Subir → publicar → preguntar “¿cuánto cuesta X?” | Bot **no** usa montos del PDF; tools catálogo o handoff `sin_catalogo` | D-MED-5/10, C3, D-BOT-2 |
| U-MED-3 | **Word** ficha sede (K02) | Publicar cambio de horario → pregunta | Texto nuevo &lt; 60 s | D-MED-6, C4 |
| U-MED-4 | **XLS split** | Import hoja precios + hoja FAQ | Precios solo Prisma; FAQ en RAG sin montos | D-MED-7, D-CAT-3, C3 |
| U-MED-5 | **Foto** narrativa (horario) | Upload imagen → publicar → pregunta | Respuesta anclada a Vision/OCR narrativo + cita | D-MED-8, C5 |
| U-MED-6 | **Foto tarifa** | Upload tarjeta precios → publicar → preguntar monto | Gate OCR; 0 montos inventados desde imagen; tools o handoff | D-MED-10, C3 |
| U-MED-7 | **Video** corto | Upload mp4 → job listo → pregunta sobre contenido hablado | Transcript indexado; C4 | D-MED-9 |
| U-MED-8 | **Adjunto lead** (WA/FB imagen) | Prospecto envía foto en hilo | Visible en expediente/hilo; **no** aparece en biblioteca K ni en hybrid search global | D-MED-11 |
| U-MED-9 | MIME inválido (p. ej. `.exe`) | Upload | 422 `UNSUPPORTED_MIME`; UI-KNW-7 | D-MED-1 |
| U-MED-10 | RBAC | Asesor intenta upload | 403 | UI-KNW-4, F1 |

---

## 10. Fixtures esperados en `fixtures/knowledge/`

Directorio objetivo (paralelo a `fixtures/catalog/` del sandbox XLS). **No commitear PII real ni precios de producción no autorizados**; usar montos sintéticos claramente de prueba.

```
fixtures/knowledge/
├── README.md                          # Cómo regenerar + licencia de samples
├── pdf/
│   ├── faq-sin-precios.pdf            # U-MED-1 / T-MED-PDF
│   └── lista-precios-tabla.pdf        # scrub / C3
├── docx/
│   └── k02-ficha-jardin1.docx         # U-MED-3
├── xlsx/
│   ├── catalog-precios.xlsx           # solo import catálogo (o symlink a fixtures/catalog)
│   └── faq-hoja-texto.xlsx            # split narrativa
├── images/
│   ├── horario-visitas.jpg            # Vision narrativa
│   └── tarjeta-precios.jpg            # OCR tariff gate
├── video/
│   └── bienvenida-30s.mp4             # Transcription (mantener corto)
├── tariff/
│   ├── tariff-scan.pdf
│   └── tariff-photo.jpg               # golden OCR
├── golden/
│   ├── scrub-expectations.json        # fragmento_id lógico → recuperable_precio: false
│   ├── vision-ocr-mocks.json          # respuestas Fake VisionPort
│   └── transcript-mocks.json          # Fake TranscriptionPort
└── mime-spoof/
    └── prices.pdf.exe.sample          # para D-MED-2 (extensión engañosa)
```

| Fixture | Consumido por |
|---|---|
| `pdf/*` | T-MED-PDF, U-MED-1/2 |
| `docx/*` | T-MED-DOCX, U-MED-3 |
| `xlsx/*` | T-MED-XLS, U-MED-4 |
| `images/*` | T-MED-IMG, U-MED-5/6 |
| `video/*` | T-MED-VID, U-MED-7 |
| `tariff/*` + `golden/scrub-expectations.json` | T-MED-OCR, coverage scrub |
| `golden/*-mocks.json` | CI sin `@live` |
| `mime-spoof/*` | T-MED-MIME |

Regla: alterar un monto en `lista-precios-tabla.pdf` / `tarjeta-precios.jpg` **no** debe cambiar ninguna respuesta de tool de catálogo (`sandbox:eval` / tools Prisma siguen siendo la fuente C3).

---

## 11. Matriz de trazabilidad rápida

| Familia | IDs | Doc producto/setup |
|---|---|---|
| Media pipeline | D-MED-1…14 | Este doc + setup/04 §3.8b |
| UI conocimiento | UI-KNW-1…8 | Este doc + setup/04 §4.2 |
| Suites | T-MED-* | §4–6 |
| Precio / rerank / frescura | C3, C5, C4 | producto/03; D-BOT-*; D-KNW-2 |
| Ports | Llm/Embeddings/Rerank/Vision/Transcription/Storage | §7 |
| Fixtures | `fixtures/knowledge/` | §10 |
| CI / live | §8 | github/03, github/04 |

---

## 12. Criterio de cierre de este entregable

Quedan definidos: criterios **D-MED-*** y **UI-KNW-***, suites **T-MED-***, pirámide unit/integration/contract/e2e/@live, mapa ID→archivo de test, contrato de **seis ports**, umbrales de coverage, casos UAT por MIME y árbol de fixtures `fixtures/knowledge/`, alineados a C3/C5/C4 y a D-BOT/D-KNW existentes — sin implementar código en `apps/`.
