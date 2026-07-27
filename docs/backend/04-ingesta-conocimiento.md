# Ingesta de conocimiento — parseo, inventario y frescura dinámica

Cómo entra el material autorizado al sistema, cómo se versiona y cómo el bot refleja cambios **el mismo día** (incluso de un minuto a otro) sin alucinar sobre versiones viejas.

SLA de frescura de producto: **&lt; 60 segundos** desde “Publicar” (documento o precio de catálogo) hasta que la siguiente respuesta del bot use la versión nueva.

## 1. Propósito

- Mantener una biblioteca de verdad **versionada** y publicable desde el panel.
- Separar **narrativa → vector + FTS** de **datos duros → catálogo Prisma**.
- Invalidar de inmediato lo obsoleto para que la documentación dinámica no genere respuestas stale.

## 2. Inventario de documentos autorizados (v1)

Cada ítem = un `DocumentoFuente` (o varios si se parte por sede).

| ID | Documento | Tipo | Alcance | Qué debe cubrir | Prioridad go-live |
|---|---|---|---|---|---|
| K01 | FAQ general Tres Cielos | FAQ | Global | Horarios comerciales, cómo llegar (alto nivel), qué tipo de venue es, preguntas típicas | Alta |
| K02 | Ficha Jardín 1 (sede activa) | Ficha de sede | Sede 1 | Nombre comercial, dirección, capacidad orientativa, características, restricciones conocidas | Alta |
| K03 | Ficha Jardín 2 | Ficha de sede | Sede 2 | Misma estructura; borrador/archivado hasta change order | Media (preparación) |
| K04 | Tipos de evento | Catálogo narrativo | Global | Boda, XV, corporativo, social, otro — descripción breve | Alta |
| K05 | Apoyo narrativo de paquetes | Narrativa | Global o por sede | Copy sin montos (o remisión a “consulta paquetes”); **montos viven en catálogo Prisma** | Media |
| K06 | Políticas de reserva / anticipos (versión prospecto) | Política | Global | Lenguaje no legalista aprobado | Media |
| K07 | Privacidad / uso de datos (versión conversacional) | Política | Global | Uso de datos del chat; remisión al aviso formal | Media |
| K08 | Escalación y límites del bot | FAQ operativa | Global | Qué no puede resolver; cuándo pide humano | Alta |
| K09 | Plantillas de respuesta safe | FAQ | Global | “Te conecto con un asesor”, “no tengo ese dato” | Alta |
| K10 | Diferencias entre sedes (si aplica) | Comparativo | Global | Solo cuando Jardín 2 esté próximo a activarse | Baja en go-live |

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

### 4.1 PDF / Word (narrativa)

1. Extraer texto por secciones/páginas.
2. Detectar y **excluir o marcar** tablas que parezcan precios/tarifas (no indexar montos).
3. Chunking semántico (por heading / párrafo), con overlap moderado.
4. Metadatos: `documento_id`, `version`, `sede`, `tipo`, `nombre_archivo` (para citas), `orden`.
5. Generar embedding + `tsvector`.

### 4.2 Excel / CSV

| Contenido del archivo | Destino |
|---|---|
| Paquetes, precios, inclusiones, reglas | `ImportacionCatalogo` → tablas Prisma ([../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md)) |
| Columna opcional “descripción larga” | Puede alimentar K05 narrativo **sin** columnas de monto |
| FAQ en hoja de texto | Puede convertirse a `DocumentoFuente` FAQ |

**Nunca** hacer chunk de una hoja de precios completa hacia pgvector como fuente de verdad de montos.

## 5. Publicación, invalidación y frescura (&lt; 60 s)

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
| Latencia publicar documento → searchable | **&lt; 60 s** |
| Latencia publicar precio → tool result nuevo | **inmediato post-commit** (mismo orden de magnitud operativo) |
| Respuestas con versión stale tras SLA | **0** en UAT |

## 6. UAT de cambios día a día

Casos obligatorios:

1. **Copy:** publicar cambio en K02 (“nuevo horario de visitas”) → preguntar al bot antes de 60 s → debe reflejar el texto nuevo y citar fuente.
2. **Precio:** publicar nuevo `PaquetePrecio` → preguntar “cuánto cuesta SKU X” → monto nuevo; existe `RegistroConsultaCatalogo`.
3. **Doble cambio el mismo día:** alterar K01 y un precio; ambos reflejados en turnos sucesivos.
4. **Archivado:** archivar K04 → deja de recuperarse; no aparece en citas.
5. **Borrador:** documento en borrador nunca aparece en respuestas.
6. **Regresión stale:** forzar pregunta a los 70 s post-publicación; falla el caso si aún responde versión anterior.

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

Inventario K01–K10 (K05 redefinido), parseo inteligente, ciclo publicar/archivar con invalidación, SLA &lt; 60 s y casos UAT de frescura dinámica documentados para implementación del worker de ingesta y del panel de Conocimiento/Catálogo.
