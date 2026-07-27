# RAG avanzado — hybrid search, rerank y anti-alucinación

Pipeline documental del Agentic RAG. Se usa **solo** para texto narrativo autorizado (FAQ, fichas de sede, políticas, tipos de evento en prosa, límites del bot). Los precios y paquetes **no** atraviesan este pipeline como fuente de montos; van a tools Prisma ([../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md)).

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
            Reranker (Cohere Rerank)
                       ↓
            ¿Algún score ≥ 0.85?
               │ no              │ sí
               ▼                 ▼
            Handoff / safe   Top 3–4 fragmentos → LLM estricto
                                 ↓
                            Respuesta + [Fuente: archivo]
                                 ↓
                            RegistroRecuperacion
```

## 3. Hybrid search (Postgres)

### 3.1 Rama vectorial

- Embedding del mensaje (y opcionalmente del rewrite).
- Filtros duros SQL: `estado_fragmento = activo`, `documento.estado = publicado`, sede global **o** sede del lead / sede activa, tipo documental permitido.
- `ORDER BY embedding <=> query_embedding` LIMIT N.

### 3.2 Rama Full Text Search

- `tsvector` sobre el texto del fragmento (configuración español si aplica).
- Misma capa de filtros de publicación/sede.
- Ranking por `ts_rank` / `websearch_to_tsquery` para nombres propios, folios, términos exactos.

### 3.3 Fusión

- Unir por `fragmento_id`, conservar mejor score de cada rama + flag de origen (`vector` | `fts` | `ambos`).
- Recortar a 10–20 candidatos antes del rerank.
- No enviar al LLM el set fusionado sin rerank.

## 4. Re-ranking

| Parámetro | Valor de producto |
|---|---|
| Proveedor default | **Cohere Rerank** |
| Entrada | Pregunta + hasta 20 pasajes |
| Umbral | **0.85** |
| Top enviado al LLM | **3 o 4** (solo los que superan umbral) |
| Si ninguno ≥ 0.85 | Handoff automático + mensaje safe (K09) |

El umbral es configurable por entorno, pero **0.85** es el default de aceptación UAT.

## 5. Prompting estricto y Chain of Thought interno

### 5.1 System prompt (contrato)

El generador opera bajo reglas equivalentes a:

> Eres un asistente estricto del venue Tres Cielos. Responde basándote ÚNICAMENTE en los fragmentos de contexto proporcionados. Si la respuesta no está claramente detallada en el contexto, debes responder con el copy seguro aprobado (“No tengo esa información en mi base de conocimiento…”) e invocar transferencia a humano. NUNCA inventes, deduzcas ni combines datos que no estén explícitos. No cites precios numéricos desde contexto narrativo si el orquestador debió usar catálogo. Al final, cita la fuente: `[Fuente: nombre_archivo]`.

### 5.2 Citas obligatorias

- Toda respuesta RAG exitosa termina con `[Fuente: …]` usando el nombre de archivo / título del `DocumentoFuente`.
- Si el modelo no puede citar → tratar como fallo y handoff (no enviar la respuesta inventiva).

### 5.3 Chain of Thought

- Razonamiento interno opcional en el proveedor (no se muestra al lead).
- Al lead solo llega la respuesta final + cita.
- El sistema valida post-hoc: presencia de cita; opcionalmente overlap mínimo con fragmentos.

## 6. Anti-alucinación — reglas duras

1. **Montos:** nunca desde RAG; solo catálogo.
2. **Disponibilidad de fechas concretas:** no afirmar sin proceso humano (salvo documento publicado que lo autorice explícitamente — no esperado en v1).
3. **Sede inactiva:** no presentar Jardín 2 como operable.
4. **Versión:** solo fragmentos de la versión publicada vigente.
5. **Vacío / score bajo:** K09 o escalación, nunca inventiva.
6. **Tablas en PDF:** preferir no indexar tablas de precios; si un PDF tiene tabla de montos, el proceso de ingesta debe **excluir** esas secciones del vector o marcarlas `no_recuperable_precio` y forzar routing a catálogo.

## 7. Registro y auditoría

`RegistroRecuperacion` guarda:

- Query original y rewrite (si hubo).
- IDs candidatos hybrid + scores.
- Scores de rerank.
- Fragmentos finales.
- Texto de respuesta (o hash) y cita.
- Flag `handoff_por_umbral`.

## 8. Relación con el inventário K

El inventario de documentos autorizados vive en [04-ingesta-conocimiento.md](04-ingesta-conocimiento.md) §2. Este pipeline consume solo los publicados.

## 9. Criterio de cierre de este entregable

Hybrid search, rerank Cohere con umbral 0.85, prompt estricto con citas, reglas anti-alucinación y separación respecto al catálogo Prisma quedan definidos como pipeline documental de producto.
