# Modelo de datos conceptual

Verdades de negocio que debe persistir el sistema. Implementación prevista: PostgreSQL + Prisma (transaccional + catálogo) y PG Vector + Full Text Search (memoria documental). Este documento no define esquema SQL ni modelos Prisma.

## 1. Principios

- **Una sola verdad del lead:** chat y CRM apuntan al mismo expediente.
- **Pertenencia a sede:** entidades operativas llevan jardín; go-live filtra a uno activo.
- **Historial inmutable de hechos:** mensajes, asignaciones, recuperaciones, consultas de catálogo y eventos operativos (bot + humano) se registran; no se reescriben en silencio.
- **Separación estricta:** datos duros de paquetes/precios (relacional) vs memoria semántica narrativa (fragmentos vectoriales + FTS).
- **Versión vigente única:** documentos y paquetes publicados tienen una versión activa; al republicar se invalida la anterior para el bot.
- **Originales en object storage:** PDF/Word/XLS/imagen/video viven como `Asset`; el RAG indexa solo texto derivado (nativo, Vision, Whisper, XLS narrativo).

## 2. Mapa de entidades

```
Organizacion
  └── Sede (Jardín)
        ├── Usuario (asesor / coordinador / admin)
        ├── Lead
        │     └── Oportunidad (expediente)
        │           ├── Asignacion (historial)
        │           ├── BriefCotizacion (snapshot)
        │           ├── EventoOperativo (telemetría bot + humano)
        │           └── Conversacion
        │                 └── Mensaje
        │                       ├── RegistroRecuperacion (0..1)
        │                       └── RegistroConsultaCatalogo (0..1)
        ├── Notificacion
        ├── Asset (object storage: pdf|docx|xlsx|csv|imagen|video)
        │     ├── DocumentoFuente ──► FragmentoVectorial (derivados multimodales)
        │     └── AdjuntoMensaje (canal; no auto-publica a K)
        ├── Paquete ──► PaqueteInclusion / PaquetePrecio / PaqueteRegla
        ├── ImportacionCatalogo (XLS/CSV → datos duros; sin vectores de montos)
        ├── GuionPlantilla (metadatos)
        └── ContadorUso (mensajería / Agentic RAG del periodo)
```

## 3. Entidades transaccionales (CRM y operación)

### 3.1 Organizacion

Cuenta cliente (Tres Cielos). Agrupa sedes, usuarios y configuración comercial de membresía.

Atributos conceptuales: nombre, datos fiscales de referencia, estado activo.

### 3.2 Sede (Jardín)

Ubicación operativa. En go-live: una activa; la segunda puede existir como inactiva.

Atributos: nombre comercial, estado (activa / inactiva), cupo mensual de mensajes asociado, zona horaria operativa, capacidad orientativa (aforo de sede).

### 3.3 Usuario

Persona del equipo Tres Cielos o operación Medina con acceso al panel.

Atributos: nombre, correo, rol (asesor / coordinador / admin), sedes a las que pertenece, flag de disponibilidad para asignación, activo/inactivo.

### 3.4 Lead (contacto)

Persona prospecto identificada en uno o más canales.

Atributos: nombre, teléfono, correo (opcionales según captura), identificadores externos (Meta PSID, WhatsApp), sede de interés, timestamps de primer y último contacto.

Relaciones: una o más oportunidades a lo largo del tiempo; conversaciones vinculadas.

### 3.5 Oportunidad (expediente)

Unidad comercial del embudo: el “caso” que el asesor trabaja.

Atributos de perfilado:

- Ocasión / tipo de evento
- Fecha tentativa + flag `fecha_flexible`
- Aforo
- Presupuesto orientativo (rango o `no_definido`)
- Paquete tentativo (FK opcional a `Paquete`) o marca `a_medida`
- Restricciones libres estructuradas cuando existan
- Calificación: `calificado` | `en_exploracion`
- Flag `listo_para_cotizar`
- Etapa de pipeline (nuevo/bot, calificado, contactado, propuesta, negociación, ganado, perdido)
- Motivo de perdido (si aplica)
- Canal de origen primario
- Sede

Relaciones: lead, asesor asignado actual, historial de asignaciones, conversación(es), brief de cotización.

### 3.6 BriefCotizacion

Snapshot consolidado para el asesor (puede materializarse como JSON versionado en la oportunidad o tabla hermana).

Atributos: campos del brief ([../producto/03-criterios-exito-cotizacion.md](../producto/03-criterios-exito-cotizacion.md) §3), `actualizado_en`, `precio_catalogo_al_momento`, bandera `precio_catalogo_desactualizado` si el catálogo cambió después.

### 3.7 Conversacion

Hilo lógico unificado por lead/oportunidad (aunque el canal físico sea FB, IG o WA).

Atributos: canal predominante o lista de canales, estado del bot (`activo` | `escalado` | `humano`), timestamp de escalación, sede.

### 3.8 Mensaje

Unidad de diálogo.

Atributos: dirección (entrante / saliente), autor (prospecto / bot / asesor), canal, contenido, timestamp, marca de si consumió unidad de cupo, referencia a plantilla utility si aplica, ruta del orquestador usada (`guion` | `catalogo` | `rag` | `handoff` | `safe`).

### 3.9 Asignacion

Hecho histórico de “quién recibió esta oportunidad y por qué”.

Atributos: oportunidad, usuario destino, regla aplicada (sede, round-robin, manual, disponibilidad), actor que asignó (sistema o coordinador), timestamp, vigente / sustituida.

### 3.10 Notificacion

Aviso operativo al equipo.

Atributos: tipo (`lead_nuevo` | `lead_calificado` | `escalacion` | `listo_para_cotizar` | otro), destinatario(s), canal de entrega (panel / email), estado (pendiente / leída / atendida), vínculo a oportunidad o conversación, timestamp, indicador de ventana 15–30 min para escalaciones.

### 3.11 GuionPlantilla (metadatos)

Referencia operativa a flujos aprobados y plantillas WhatsApp utility (no sustituye el motor de Meta/Twilio).

Atributos: nombre, canal, estado de aprobación, versión de copy, sede o global.

### 3.12 EventoOperativo

Hecho inmutable de telemetría: **cómo trabajó el bot** o **cómo trabajó el agente humano**.

Atributos comunes: tipo de evento, actor (`bot` | `asesor` | `coordinador` | `admin` | `sistema`), timestamp, sede, vínculo a oportunidad y/o conversación y/o mensaje, payload JSON tipado.

**Payload bot (ejemplos):** `ruta` (`guion` | `catalogo` | `rag` | `handoff` | `safe`), tools + latencias, scores de rerank, IDs de fragmentos/SKU, tokens/cupo, motivo handoff, `paso_guion`, resultado calificación / `listo_para_cotizar`; FK opcional a `RegistroRecuperacion` / `RegistroConsultaCatalogo`.

**Payload humano (ejemplos):** alerta vista/atendida, toma de control, primer mensaje post-escalación (`latencia_ms`, flag dentro/fuera de ventana 15–30 min), edición de campos, cambio de etapa (de→a), reasignación (origen/destino), devolución a bot.

Producto: [../producto/04-escenarios-rol-carga-telemetria.md](../producto/04-escenarios-rol-carga-telemetria.md) §7.

## 4. Entidades de conocimiento documental (PG Vector + FTS)

Detalle multimodal (Asset, índices, invariantes, XLS vs narrativo, adjuntos de canal): [03-assets-y-fragmentos-multimodales.md](03-assets-y-fragmentos-multimodales.md).

### 4.0 Asset

Binario en object storage (obligatorio) con metadatos de pipeline.

Atributos clave: `tipo_material` (`pdf` | `docx` | `xlsx` | `csv` | `imagen` | `video`), MIME, `storage_key`, checksum, bytes, `duracion_sec` (video ≤ 5 min), `pipeline_estado` (`pendiente` | `procesando` | `listo` | `parcial` | `error`), propósito (`conocimiento` | `import_catalogo` | `adjunto_canal`).

### 4.1 DocumentoFuente

Pieza de verdad narrativa autorizada (FAQ, fichas, políticas). **No** es la fuente primaria de precios/montos. En v1 multimodal apunta a un `Asset` original.

Atributos: título, tipo (FAQ, ficha de sede, política, tipos de evento, safe replies), sede (global o por jardín), versión, estado (borrador / publicado / archivado), fecha de publicación, `publicado_en`, responsable de aprobación, nombre de archivo para citas, FK `asset_id`, espejo de `tipo_material` / `pipeline_estado`.

### 4.2 FragmentoVectorial

Pasaje indexable del documento (siempre texto, aunque derive de foto/video).

Atributos: texto del pasaje, orden dentro del documento, metadatos de filtro (sede, tipo, vigencia, `documento_version_id`), embedding para similitud, representación FTS (`tsvector` o equivalente), estado activo (solo versión publicada vigente), `origen_derivacion` (`texto_nativo` | `vision` | `whisper` | `xls_narrativo`), flag `no_recuperable_precio`, opcionales `page_or_slide`, `t_start_ms` / `t_end_ms`.

### 4.3 RegistroRecuperacion

Trazabilidad de qué se usó para responder vía RAG.

Atributos: pregunta o mensaje del lead, candidatos hybrid, scores de rerank, fragmentos finales enviados al LLM, umbral aplicado, conversación/mensaje asociado, timestamp, bandera handoff por baja confianza, `tipo_material` / `origen_derivacion` de fragmentos usados.

### 4.4 AdjuntoMensaje

Media de canal ligada a `Mensaje` vía `Asset` (`proposito = adjunto_canal`). Clasificación ligera para el expediente; **no** indexa automáticamente en la biblioteca K ni autoriza montos desde OCR.

## 5. Entidades de catálogo (datos duros)

Detalle completo: [02-catalogo-paquetes.md](02-catalogo-paquetes.md).

Resumen: `Paquete`, `PaqueteInclusion`, `PaquetePrecio`, `PaqueteRegla`, `ImportacionCatalogo`, `RegistroConsultaCatalogo`.

## 6. Entidades de membresía y uso

### 6.1 ContadorUso / PeriodoCupo

Por sede (o cuenta) y mes calendario:

- Unidades de mensajería consumidas (Meta, WhatsApp, email transaccional).
- Tope (p. ej. 1,000).
- Uso de Agentic RAG (recuperaciones, rerank, generación, tools de catálogo — orden de magnitud / tokens equivalentes).
- Banderas de aproximación a tope para vista gerencial.

## 7. Relaciones críticas (cardinalidad de negocio)

| Relación | Cardinalidad | Nota |
|---|---|---|
| Organizacion → Sede | 1 a muchos | Tres Cielos con hasta 2 jardines en alcance comercial |
| Sede → Usuario | muchos a muchos | Un coordinador puede ver más de una sede |
| Lead → Oportunidad | 1 a muchos | Recontactos / nuevos eventos |
| Oportunidad → Conversacion | 1 a 1 o 1 a pocos | Preferir un hilo principal por oportunidad |
| Conversacion → Mensaje | 1 a muchos | Historial ordenado |
| Oportunidad → Asignacion | 1 a muchos | Historial; una vigente |
| Oportunidad → EventoOperativo | 1 a muchos | Telemetría bot + humano |
| Conversacion / Mensaje → EventoOperativo | 0 a muchos | Decisiones por turno |
| Asset → DocumentoFuente | 0 a 1 | Biblioteca K; storage obligatorio |
| DocumentoFuente → Fragmento | 1 a muchos | Indexación; solo versión activa recuperable |
| Mensaje → AdjuntoMensaje | 0 a muchos | Media canal; no auto-publica a K |
| AdjuntoMensaje → Asset | 1 | Mismo almacén, distinto propósito |
| Mensaje → RegistroRecuperacion | 0 a 1 | Solo si hubo consulta documental |
| Mensaje → RegistroConsultaCatalogo | 0 a 1 | Solo si hubo tool de catálogo |
| EventoOperativo → RegistroRecuperacion | 0 a 1 | Si la decisión usó RAG |
| EventoOperativo → RegistroConsultaCatalogo | 0 a 1 | Si la decisión usó tools |
| Paquete → PaquetePrecio | 1 a muchos | Vigencias / unidades |
| Oportunidad → Paquete | 0 a 1 | Tentativo; o `a_medida` |

## 8. Estados que la base debe poder representar

### Calificación de oportunidad

`en_exploracion` → `calificado` (también puede quedarse en exploración si abandona). Flag independiente: `listo_para_cotizar`.

### Bot / conversación

`activo` → `escalado` → `humano` (retorno a bot solo si se define política; en v1 no es requisito).

### Pipeline

Según [../producto/01-diseno-estrategico.md](../producto/01-diseno-estrategico.md) §5.

### Documento de conocimiento / Paquete

`borrador` → `publicado` → `archivado`.

### Pipeline de Asset / ingesta

`pendiente` → `procesando` → `listo` | `parcial` | `error`. El bot solo recupera fragmentos de documentos `publicado` + `listo`.

### Sede

`activa` | `inactiva`.

## 9. Qué no modela este núcleo (a propósito)

- Audiencias de remarketing, drips multi-día, scoring predictivo.
- Inventario de eventos / ERP / cobros / contratos firmados.
- Contenido creativo de anuncios.
- Widgets web o canales fuera de Meta + WhatsApp.
- Embeddings de filas Excel de precios (prohibido como fuente de montos).
- Auto-publicación de adjuntos de canal a la biblioteca K.
- BI comercial / reportes marketing (distinto de `EventoOperativo` y telemetría operativa del panel).

## 10. Criterio de cierre de este entregable

Quedan fijadas las entidades de CRM, conversación/mensaje, brief, asignación, notificación, cupo, `EventoOperativo` (telemetría bot+humano), el trío documental DocumentoFuente → FragmentoVectorial → RegistroRecuperacion, el catálogo de paquetes como fuente de verdad de datos duros, y el eje multimodal `Asset` / fragmentos derivados / `AdjuntoMensaje` (detalle en [03-assets-y-fragmentos-multimodales.md](03-assets-y-fragmentos-multimodales.md)).
