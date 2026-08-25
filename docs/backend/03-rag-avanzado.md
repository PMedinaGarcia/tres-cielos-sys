# RAG avanzado — hybrid search, rerank y anti-alucinación

Pipeline documental del Agentic RAG. Se usa **solo** para texto narrativo autorizado (FAQ, fichas de sede, políticas, tipos de evento en prosa, límites del bot, **y texto derivado de foto/video** publicado en biblioteca K). Los precios y paquetes **no** atraviesan este pipeline como fuente de montos; van a tools Prisma ([../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md)).

Proveedores: embeddings/LLM OpenAI + **Cohere Rerank** — [07-pipeline-openai-y-proveedores.md](07-pipeline-openai-y-proveedores.md). Ingesta media: [08-ingesta-multimodal.md](08-ingesta-multimodal.md).

## 1. Por qué el RAG básico no basta

Si se cortan PDFs/Excels en trozos y se buscan solo por embedding:

- Las tablas se rompen (filas/columnas mezcladas).
- Los códigos SKU y nombres propios fallan frente a similitud semántica.
- El LLM mezcla contextos de los top-k amplios y alucina.

Por eso el producto exige: **separación estructurado vs narrativo**, **búsqueda híbrida**, **rerank con umbral**, **prompt estricto con citas**.

## 2. Arquitectura del pipeline

```
Pregunta del lead (rama documental)
        ↓
Query rewrite opcional (clarificar sede / tipo evento si está en contexto)
        ↓
┌───────────────────────┬────────────────────────┐
│  pgvector (semántica) │  PostgreSQL FTS (exacto)│
└───────────┬───────────┴────────────┬───────────┘
            │                        │
            └──────────┬─────────────┘
                       ↓
            Fusión / dedupe → top 10–20 candidatos
                       ↓
            Reranker (Cohere Rerank) — sobre texto de fragmentos
                       ↓
            ¿Algún score ≥ 0.85?
               │ no              │ sí
               ▼                 ▼
            Handoff / safe   Top 3–4 fragmentos → LLM estricto
                                 ↓
                            Respuesta + [Fuente: archivo | tipo: material]
                                 ↓
                            RegistroRecuperacion
```

Los candidatos pueden originarse en PDF/Word **o** en texto derivado de Vision/Whisper; el rerank **no** recibe imágenes ni audio crudos, solo pasajes de texto.

## 3. Hybrid search (Postgres)

### 3.1 Rama vectorial

- Embedding del mensaje (y opcionalmente del rewrite) vía `EmbeddingPort` (OpenAI).
- Filtros duros SQL: `estado_fragmento = activo`, `documento.estado = publicado`, sede global **o** sede del lead / sede activa, tipo documental permitido.
- Incluye fragmentos cuyo `texto` fue producido por parsers nativos **o** por pipelines Vision/Whisper (mismo índice pgvector).
- `ORDER BY embedding <=> query_embedding` LIMIT N.

### 3.2 Rama Full Text Search

- `tsvector` sobre el texto del fragmento (configuración español si aplica) — **incluyendo** texto derivado multimodal.
- Misma capa de filtros de publicación/sede.
- Ranking por `ts_rank` / `websearch_to_tsquery` para nombres propios, folios, términos exactos.

### 3.3 Fusión

- Unir por `fragmento_id`, conservar mejor score de cada rama + flag de origen (`vector` | `fts` | `ambos`).
- Recortar a 10–20 candidatos antes del rerank.
- No enviar al LLM el set fusionado sin rerank.
- Conservar metadatos: `tipo_material`, `no_recuperable_precio`, `nombre_archivo`.

## 4. Re-ranking

| Parámetro | Valor de producto |
|---|---|
| Proveedor default | **Cohere Rerank** |
| Entrada | Pregunta + hasta 20 **pasajes de texto** (nativos o derivados) |
| Umbral | **0.85** |
| Top enviado al LLM | **3 o 4** (solo los que superan umbral) |
| Si ninguno ≥ 0.85 | Handoff automático + mensaje safe (K09) |

El umbral es configurable por entorno, pero **0.85** es el default de aceptación UAT.

### 4.1 Cohere sobre texto derivado (Vision / Whisper)

| Origen del fragmento | ¿Entra a Cohere? | Notas |
|---|---|---|
| PDF/Word texto nativo | Sí | Igual que v1 clásico |
| Texto de Vision (foto / página escaneada) | Sí | Solo el `texto_derivado` ya scrubbeado |
| Transcripción Whisper (video) | Sí | Idem; no se envía el MP4 a Cohere |
| Binario imagen/audio crudo | **No** | Fuera del contrato Rerank |

Reglas:

1. La calidad del rerank depende del scrub: si el texto derivado está lleno de montos, marcar `no_recuperable_precio` y/o excluir pasajes de tarifa **antes** de indexar.
2. Cohere no distingue “foto” vs “pdf”; el `tipo_material` viaja en metadatos al LLM para la cita, no como señal del reranker.
3. Fallo de Cohere → safe + handoff (`proveedor_ia`); no saltar al LLM con top-k hybrid crudo.

## 5. Prompting estricto y Chain of Thought interno

### 5.1 System prompt (contrato)

El generador opera bajo reglas equivalentes a:

> Eres un asistente estricto del venue Tres Cielos. Responde basándote ÚNICAMENTE en los fragmentos de contexto proporcionados. Si la respuesta no está claramente detallada en el contexto, debes responder con el copy seguro aprobado (“No tengo esa información en mi base de conocimiento…”) e invocar transferencia a humano. NUNCA inventes, deduzcas ni combines datos que no estén explícitos. No cites precios numéricos desde contexto narrativo (incluido texto derivado de foto/video u OCR) si el orquestador debió usar catálogo. Al final, cita la fuente: `[Fuente: nombre_archivo | tipo: tipo_material]`.

### 5.2 Citas obligatorias

- Toda respuesta RAG exitosa termina con `[Fuente: … | tipo: …]` usando el nombre de archivo / título del `DocumentoFuente` y el `tipo_material` del fragmento (`pdf`, `word`, `foto`, `video`, `faq`, etc.).
- Si el modelo no puede citar → tratar como fallo y handoff (no enviar la respuesta inventiva).
- Detalle de formato: [02-orquestador-agentico.md](02-orquestador-agentico.md) §5.1.

### 5.3 Chain of Thought

- Razonamiento interno opcional en el proveedor (no se muestra al lead).
- Al lead solo llega la respuesta final + cita.
- El sistema valida post-hoc: presencia de cita; opcionalmente overlap mínimo con fragmentos.

## 6. Anti-alucinación — reglas duras

1. **Montos:** nunca desde RAG; solo catálogo. Tampoco desde OCR/Vision/Whisper.
2. **Disponibilidad de fechas concretas:** no afirmar sin proceso humano (salvo documento publicado que lo autorice explícitamente — no esperado en v1).
3. **Sede inactiva:** no presentar Jardín 2 como operable.
4. **Versión:** solo fragmentos de la versión publicada vigente.
5. **Vacío / score bajo:** K09 o escalación, nunca inventiva.
6. **Tablas en PDF / tarifas en foto:** preferir no indexar tablas de precios; si un PDF o imagen tiene tabla/cartel de montos, el proceso de ingesta debe **excluir** esas secciones del vector o marcarlas `no_recuperable_precio` y forzar routing a catálogo ([02-orquestador-agentico.md](02-orquestador-agentico.md) §4.5).
7. **Fragmentos derivados:** se tratan como cualquier otro pasaje narrativo tras scrub; no tienen privilegio extra ni se cotiza desde ellos.

## 6.1 Metadatos de fragmento relevantes al RAG

| Campo | Uso en pipeline |
|---|---|
| `texto` | Único contenido enviado a FTS, embedding, Cohere y LLM |
| `tipo_material` | Cita al lead; telemetría; filtros opcionales |
| `no_recuperable_precio` | Gate de orquestador; generador no emite montos de ese pasaje |
| `origen_derivacion` | `nativo` \| `vision` \| `whisper` (auditoría) |
| `nombre_archivo` | Cita `[Fuente: …]` |

## 7. Registro y auditoría

`RegistroRecuperacion` guarda:

- Query original y rewrite (si hubo).
- IDs candidatos hybrid + scores.
- Scores de rerank.
- Fragmentos finales.
- Texto de respuesta (o hash) y cita.
- Flag `handoff_por_umbral`.
- Flags de fragmentos usados (`no_recuperable_precio`, `tipo_material`, `origen_derivacion`).

## 8. Relación con el inventário K

El inventario de documentos autorizados vive en [04-ingesta-conocimiento.md](04-ingesta-conocimiento.md) §2. Este pipeline consume solo los publicados (incluidos los derivados de foto/video cuando el admin los publicó). Adjuntos de canal **no** entran al índice K automáticamente ([08-ingesta-multimodal.md](08-ingesta-multimodal.md) §2).

## 9. Criterio de cierre de este entregable

Hybrid search, rerank Cohere con umbral 0.85 **sobre texto nativo y derivado**, prompt estricto con citas tipadas por material, reglas anti-alucinación (incl. `no_recuperable_precio`) y separación respecto al catálogo Prisma quedan definidos como pipeline documental de producto.
