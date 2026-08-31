# Ingesta de conocimiento — parseo, inventario y frescura dinámica

Cómo entra el material autorizado al sistema, cómo se versiona y cómo el bot refleja cambios **el mismo día** (incluso de un minuto a otro) sin alucinar sobre versiones viejas.

SLA de frescura de producto (**texto** PDF/Word/FAQ): **&lt; 60 segundos** desde “Publicar” hasta que la siguiente respuesta del bot use la versión nueva. Foto y video tienen SLAs propios (§5.5 y [08-ingesta-multimodal.md](08-ingesta-multimodal.md)).

## 1. Propósito

- Mantener una biblioteca de verdad **versionada** y publicable desde el panel.
- Separar **narrativa → vector + FTS** de **datos duros → catálogo Prisma**.
- Invalidar de inmediato lo obsoleto para que la documentación dinámica no genere respuestas stale.

## 2. Inventario de documentos autorizados (v1)

Cada ítem = un `DocumentoFuente` (o varios si se parte por sede).

| ID | Documento | Tipo | Alcance | Qué debe cubrir | Prioridad go-live |
|---|---|---|---|---|---|
| K01 | FAQ general Tres Cielos | FAQ | Global | Dirección y cómo llegar (alto nivel), qué tipo de venue es, preguntas típicas; visitas las agenda un asesor | Alta |
| K02 | Ficha Jardín 1 (sede activa) | Ficha de sede | Sede 1 | Nombre comercial, dirección, cómo llegar, características de locación; GPS y restricciones no publicadas | Alta |
| K03 | Ficha Jardín 2 | Ficha de sede | Sede 2 | Misma estructura; borrador/archivado hasta change order | Media (preparación) |
| K04 | Tipos de evento | Catálogo narrativo | Global | Boda, XV, corporativo, social, otro — descripción breve | Alta |
| K05 | Apoyo narrativo de paquetes | Narrativa | Global o por sede | Copy sin montos (o remisión a “consulta paquetes”); **montos viven en catálogo Prisma** | Media |
| K06 | Políticas de reserva / anticipos (versión prospecto) | Política | Global | Lenguaje no legalista aprobado | Media |
| K07 | Privacidad / uso de datos (versión conversacional) | Política | Global | Uso de datos del chat; remisión al aviso formal | Media |
| K08 | Escalación y límites del bot | FAQ operativa | Global | Qué no puede resolver; cuándo pide humano | Alta |
| K09 | Plantillas de respuesta safe | FAQ | Global | “Te conecto con un asesor”, “no tengo ese dato” | Alta |
| K10 | Diferencias entre sedes (si aplica) | Comparativo | Global | Solo cuando Jardín 2 esté próximo a activarse | Baja en go-live |
| K11 | Módulos atómicos de inclusión | Módulo | Por concepto | Un archivo por inclusión (locación, cóctel, banquete, …); alimentan K05. Corpus: `fixtures/negocio/ediciones/*/modulos/` | Alta (contenido Julio 2026) |
| K12 | Hospedaje y cortesías (prosa) | Promoción narrativa | Global | Condiciones de cortesía **sin montos**; umbrales en catálogo/promociones | Media |
| K13 | Upgrades / add-ons estacionales | Módulo | Global | Sección vacía a propósito; nuevas filas de promoción, no parche al SKU | Media |
| K14 | Condiciones comerciales de cotización | Política | Global | Vigencia 30 días, IVA, no aparta fecha, horario de evento; evergreen | Alta |

Detalle de composición, anti-monto y edición activa: [../negocio/04-inventario-k-negocio.md](../negocio/04-inventario-k-negocio.md). Contrato de archivos: [`fixtures/negocio/`](../../fixtures/negocio/README.md).

### Fuera del inventario v1 (no indexar en vector)

- Contratos legales completos, NDAs, costos internos, comisiones.
- Excels/CSV de precios e inclusiones → **import a catálogo**, no a pgvector.
- Creatividades de anuncios o briefings de pauta.
- Bases históricas de leads fríos.
- Scripts de campañas masivas WhatsApp marketing.

## 3. Ciclo de vida del documento

```
Borrador (carga admin) → Revisión / aprobación Tres Cielos
        → Publicado (job de ingesta prioridad alta)
              → chunk + embed + FTS
              → invalidar fragmentos de versión anterior
              → bot consume solo versión vigente
        → Archivado (exclusión inmediata de hybrid search)
```

Reglas:

- Solo estado **publicado** entra a la memoria vectorial/FTS activa.
- Toda actualización material = nueva versión o republicación; el bot no usa borradores.
- Documentos por sede: si la sede está inactiva, no se recuperan en operación (salvo pruebas controladas).

## 4. Parseo inteligente

El enrutado por MIME, allowlist, object storage obligatorio, estados de job y límites (video ≤ 5 min) están detallados en **[08-ingesta-multimodal.md](08-ingesta-multimodal.md)**. Este documento resume el destino de negocio por tipo.

### 4.1 PDF / Word (narrativa)

1. Extraer texto por secciones/páginas.
2. Detectar y **excluir o marcar** tablas que parezcan precios/tarifas (no indexar montos) → flag `no_recuperable_precio` si queda prosa adyacente.
3. Páginas escaneadas sin texto → Vision (ver doc 08); el resultado es texto derivado indexable.
4. Chunking semántico (por heading / párrafo), con overlap moderado.
5. Metadatos: `documento_id`, `version`, `sede`, `tipo`, `tipo_material`, `nombre_archivo` (para citas), `orden`, `origen_derivacion`.
6. Generar embedding + `tsvector`.

### 4.2 Excel / CSV

| Contenido del archivo | Destino |
|---|---|
| Paquetes, precios, inclusiones, reglas | `ImportacionCatalogo` → tablas Prisma ([../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md)) |
| Columna opcional “descripción larga” | Puede alimentar K05 narrativo **sin** columnas de monto |
| FAQ en hoja de texto | Puede convertirse a `DocumentoFuente` FAQ |

**Nunca** hacer chunk de una hoja de precios completa hacia pgvector como fuente de verdad de montos.

### 4.3 Foto (biblioteca K)

1. Upload admin → object storage (obligatorio).
2. Pipeline Vision → `texto_derivado` (descripción / texto visible).
3. Scrub de tarifas; si hay montos OCR → `no_recuperable_precio` (no cotizar desde este material).
4. Chunk del texto derivado + embedding + FTS; `tipo_material = foto`.
5. SLA publicar → searchable: **&lt; 90 s** (§5.5).
6. Cita al lead: `[Fuente: archivo | tipo: foto]`.

No usar fotos de canal del prospecto como publicación K automática.

### 4.4 Video (biblioteca K)

1. Validar duración **≤ 5 minutos** y MIME allowlist; si excede → `rechazado`.
2. Object storage → demux audio → Whisper → transcripción.
3. Scrub de tarifas en la transcripción (mismo criterio que PDF/foto).
4. Chunk + embed + FTS; `tipo_material = video`; guardar `duracion_ms`.
5. SLA publicar → searchable: **&lt; 5 min** (§5.5).
6. Cita: `[Fuente: archivo | tipo: video]`.

Detalle de estados (`recibido` → `listo` / `error` / `rechazado`): [08-ingesta-multimodal.md](08-ingesta-multimodal.md) §7.

## 5. Publicación, invalidación y frescura (SLAs por tipo)

### 5.1 Al publicar un documento

1. Persistir nueva `version` y `publicado_en`.
2. Encolar job de ingesta con **prioridad alta** (o ejecutar síncrono si el documento es pequeño).
3. Generar nuevos `FragmentoVectorial` activos.
4. Marcar fragmentos de la versión anterior como `inactivos` / excluidos del search **en la misma transacción lógica de “corte”** (o swap atómico de `version_activa_id`).
5. Invalidar cualquier cache de aplicación de fragmentos (TTL corto; preferible no cachear o cache key = `documento_version_id`).
6. Emitir evento de auditoría “conocimiento publicado”.

### 5.2 Al archivar

- Exclusión inmediata de hybrid search (mismo mecanismo de invalidación).
- Conservar historial y registros de recuperaciones pasadas.

### 5.3 Al publicar precio / paquete de catálogo

- No pasa por embeddings.
- Tras commit de `estado = publicado`, la siguiente tool Prisma debe devolver el nuevo valor.
- Oportunidades con brief abierto que referencian el SKU: marcar `precio_catalogo_desactualizado`.

### 5.4 SLA y medición

| Métrica | Objetivo |
|---|---|
| Latencia publicar **documento texto** (PDF/Word/FAQ) → searchable | **&lt; 60 s** |
| Latencia publicar **foto** → searchable | **&lt; 90 s** |
| Latencia publicar **video** (≤ 5 min) → searchable | **&lt; 5 min** |
| Latencia publicar precio → tool result nuevo | **inmediato post-commit** (mismo orden de magnitud operativo) |
| Respuestas con versión stale tras el SLA de su tipo | **0** en UAT |

Alertas de cola: si un job de texto supera 60 s, de foto 90 s o de video 5 min, notificar a admin/Medina (infra + telemetría).

### 5.5 SLAs diferenciados por tipo de material

```
Publicar DocumentoFuente
        ↓
MediaRouter (MIME) ──► texto ──► SLA &lt; 60 s
                   ──► foto  ──► SLA &lt; 90 s  (Vision)
                   ──► video ──► SLA &lt; 5 min (Whisper; dur ≤ 5 min)
                   ──► xls precios ──► Prisma (sin embeddings)
```

Prioridad de cola y allowlist: [08-ingesta-multimodal.md](08-ingesta-multimodal.md) §4 y §8. El path de **adjuntos de canal** (no biblioteca) usa los mismos parsers/SLAs de extracción pero **no** publica a K.

## 6. UAT de cambios día a día

Casos obligatorios:

1. **Copy:** publicar cambio en K02 (“nuevo horario de visitas”) → preguntar al bot antes de 60 s → debe reflejar el texto nuevo y citar fuente (con tipo de material).
2. **Precio:** publicar nuevo `PaquetePrecio` → preguntar “cuánto cuesta SKU X” → monto nuevo; existe `RegistroConsultaCatalogo`.
3. **Doble cambio el mismo día:** alterar K01 y un precio; ambos reflejados en turnos sucesivos.
4. **Archivado:** archivar K04 → deja de recuperarse; no aparece en citas.
5. **Borrador:** documento en borrador nunca aparece en respuestas.
6. **Regresión stale:** forzar pregunta tras el SLA de su tipo; falla el caso si aún responde versión anterior.
7. **Foto:** publicar imagen de salón sin precios → searchable &lt; 90 s; cita `tipo: foto`; pregunta de ambiente puede anclarse al derivado.
8. **Foto con tarifas OCR:** flag `no_recuperable_precio`; “cuánto cuesta” → tools/handoff, nunca monto del OCR.
9. **Video:** clip ≤ 5 min → listo &lt; 5 min; clip &gt; 5 min → rechazado.

Casos multimodal ampliados: [08-ingesta-multimodal.md](08-ingesta-multimodal.md) §11.

## 7. Responsabilidades de entrega de contenido

| Actor | Responsabilidad |
|---|---|
| Tres Cielos | Proveer y aprobar textos, políticas y catálogo de paquetes/precios |
| Medina Systems (admin) | Cargar, fragmentar, publicar, archivar; importar catálogo; monitorear frescura y uso |
| Asesor | No edita la biblioteca en v1; reporta respuestas incorrectas del bot |
| Coordinador | Canaliza correcciones de copy hacia admin |

## 8. Relación con el guion conversacional

| Situación | Fuente de verdad |
|---|---|
| Orden de preguntas (ocasión, fecha, aforo…) | Guion aprobado (flujo) |
| Texto de bienvenida / cierre de captura | Guion |
| “¿Dónde están?”, “¿cabemos 150?” (capacidad narrativa) | Conocimiento (K01–K02) vía RAG |
| “¿Precios / paquetes / qué incluye?” | Catálogo Prisma vía tools |
| “Quiero hablar con alguien” | Escalación (K08) |
| Datos guardados en CRM / brief | Calificación + expediente |

La recuperación documental y el catálogo **complementan** el guion; no lo reemplazan.

## 9. Criterio de cierre de este entregable

Inventario K01–K10 (K05 redefinido), parseo inteligente (PDF/Word/XLS + foto/video), ciclo publicar/archivar con invalidación, SLAs diferenciados (texto &lt; 60 s, foto &lt; 90 s, video &lt; 5 min) y casos UAT de frescura dinámica documentados para implementación del worker de ingesta y del panel de Conocimiento/Catálogo. Contrato multimodal completo: [08-ingesta-multimodal.md](08-ingesta-multimodal.md). Proveedores IA: [07-pipeline-openai-y-proveedores.md](07-pipeline-openai-y-proveedores.md).
