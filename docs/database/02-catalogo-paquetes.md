# Catálogo de paquetes — modelo preciso para eventos sociales

Fuente de verdad de **datos duros** (precios, inclusiones, aforos, reglas). El orquestador consulta este catálogo con Function Calling vía Prisma; **no** se indexan Excels de precios en pgvector como fuente de montos.

Referencias: [01-modelo-conceptual.md](01-modelo-conceptual.md), [../backend/02-orquestador-agentico.md](../backend/02-orquestador-agentico.md), [../producto/03-criterios-exito-cotizacion.md](../producto/03-criterios-exito-cotizacion.md).

## 1. Principio anti-alucinación

| Tipo de dato | Dónde vive | Cómo se recupera |
|---|---|---|
| Monto, rango de precio, unidad | `PaquetePrecio` | Tool Prisma |
| Inclusiones tipadas | `PaqueteInclusion` | Tool Prisma |
| Aforo min/max del paquete | `Paquete` | Tool Prisma |
| Reglas (fin de semana, feriados, anticipo mínimo) | `PaqueteRegla` | Tool Prisma |
| Descripción comercial narrativa (“ambiente jardín…”) | Opcional: campo texto en `Paquete` **o** documento K vinculado | Tool o RAG narrativo; **nunca** como sustituto del monto |

Si no hay fila **publicada y vigente** → el agente **no estima**; safe reply o handoff.

## 2. Entidades

### 2.1 Paquete

SKU comercial publicable.

| Atributo | Descripción |
|---|---|
| `codigo_sku` | Identificador estable (ej. `BODA-J1-ESENCIAL`) |
| `nombre` | Nombre comercial |
| `tipo_evento` | boda \| xv \| corporativo \| social \| otro \| multi |
| `sede_id` | Sede o null = global |
| `aforo_min` / `aforo_max` | Rango para el que aplica |
| `descripcion_corta` | Texto corto para respuesta (no sustituye inclusiones) |
| `estado` | borrador \| publicado \| archivado |
| `version` | Entero monotónico por SKU |
| `vigente_desde` / `vigente_hasta` | Ventana comercial opcional |
| `publicado_en` | Timestamp de última publicación |

### 2.2 PaqueteInclusion

Filas tipadas; una inclusión = una fila.

| Atributo | Descripción |
|---|---|
| `paquete_id` | FK |
| `categoria` | catering \| mobiliario \| audio \| decoracion \| personal \| otro |
| `nombre` | Ej. “Menú tres tiempos” |
| `cantidad` / `unidad` | Opcional |
| `obligatoria` | boolean |
| `orden` | Para listados estables |

Prohibido mezclar varias inclusiones en un único blob de texto como única representación.

### 2.3 PaquetePrecio

| Atributo | Descripción |
|---|---|
| `paquete_id` | FK |
| `moneda` | MXN (default) |
| `monto` | Precio cerrado si aplica |
| `rango_min` / `rango_max` | Si el bot solo puede decir rangos |
| `unidad` | evento \| persona \| otro |
| `condiciones` | Texto corto de condiciones de precio (no legales) |
| `vigente_desde` / `vigente_hasta` | Obligatoria la vigencia efectiva |
| `estado` | borrador \| publicado \| archivado |

Regla: a una fecha de consulta, a lo sumo **un** precio publicado vigente por paquete+unidad (o resolución documentada si hay más).

### 2.4 PaqueteRegla

Restricciones consultables.

| Atributo | Descripción |
|---|---|
| `paquete_id` | FK |
| `tipo` | solo_fin_semana \| no_feriados \| anticipo_minimo \| horario \| otro |
| `parametros` | JSON conceptual (ej. `{ "anticipo_pct": 30 }`) |
| `mensaje_prospecto` | Copy aprobado si la regla bloquea |

### 2.5 ImportacionCatalogo

Auditoría de carga desde Excel/CSV.

| Atributo | Descripción |
|---|---|
| `actor` | Usuario admin |
| `archivo` | Nombre |
| `iniciado_en` / `terminado_en` | Timestamps |
| `filas_ok` / `filas_error` | Conteos |
| `detalle_errores` | Filas rechazadas (SKU, motivo) |
| `resultado` | exito \| parcial \| fallo |

### 2.6 RegistroConsultaCatalogo

Trazabilidad por mensaje.

| Atributo | Descripción |
|---|---|
| `mensaje_id` / `conversacion_id` | Vínculo |
| `tool` | Nombre de la tool |
| `filtros` | Payload de entrada |
| `filas_devueltas` | IDs / resumen |
| `timestamp` | |

## 3. Importación desde Excel/CSV

### Columnas mínimas sugeridas (hoja Paquetes)

`sku`, `nombre`, `tipo_evento`, `sede`, `aforo_min`, `aforo_max`, `descripcion_corta`, `estado`

### Hoja Precios

`sku`, `moneda`, `monto`, `rango_min`, `rango_max`, `unidad`, `vigente_desde`, `vigente_hasta`, `condiciones`

### Hoja Inclusiones

`sku`, `categoria`, `nombre`, `cantidad`, `unidad`, `obligatoria`

### Reglas de import

1. Validar SKU, tipos y fechas antes de escribir.
2. Filas inválidas no bloquean necesariamente todo el archivo (`parcial` + reporte).
3. Publicar paquetes/precios es un paso explícito (o flag `publicar_al_importar` solo para admin).
4. **No** crear `FragmentoVectorial` a partir de columnas de monto.
5. Opcional: si hay columna `descripcion_larga`, puede generar o actualizar un documento narrativo vinculado al SKU (K de apoyo), nunca el precio.

## 4. Tools del agente (contrato conceptual NestJS)

### `buscar_paquetes`

Entrada: `{ tipoEvento, sedeId?, aforo?, fecha? }`  
Salida: lista de paquetes **publicados** que cumplan aforo y vigencia/reglas básicas.  
Vacío → handoff o “te conecto con un asesor para armar algo a medida”.

### `obtener_precio_paquete`

Entrada: `{ paqueteId, fecha? }`  
Salida: precio vigente a la fecha o error `sin_precio_vigente`.  
Prohibido interpolar o redondear “de memoria”.

### `listar_inclusiones`

Entrada: `{ paqueteId }`  
Salida: inclusiones ordenadas tipadas.

### `comparar_paquetes`

Entrada: `{ ids: string[] }` (máx. 3)  
Salida: tabla de diferencias (precio, aforo, inclusiones clave).

### `evaluar_reglas_paquete`

Entrada: `{ paqueteId, fecha?, aforo? }`  
Salida: reglas que aplican / bloquean + `mensaje_prospecto`.

## 5. Relación con inventario documental (K05)

| Antes (IA ligera) | Ahora (Agentic RAG) |
|---|---|
| K05 = rangos de precio en PDF como fuente primaria | Catálogo Prisma = fuente primaria de montos |
| Bot recupera fragmento y “lee” el precio | Bot llama `obtener_precio_paquete` |
| K05 narrativo | Puede existir como copy de apoyo (“nuestros paquetes parten de…”) **sin cifras** o remitiendo a catálogo |

## 6. Ciclo de vida y frescura de precios

```
Borrador (CRUD o import) → Revisión → Publicado
        → Bot consume de inmediato (sin pasar por vector)
        → Archivado / nueva versión → precio anterior deja de devolverse
```

- Cambio de precio el mismo día: al publicar, la **siguiente** consulta de tool debe devolver el nuevo monto (latencia ligada a commit DB; objetivo alineado a &lt; 60 s operativos junto con docs).
- Briefs abiertos: marcar `precio_catalogo_desactualizado` si el precio del SKU tentativo cambió tras el snapshot.

## 7. Casos de consulta (eventos sociales)

| Pregunta del lead | Tool | Éxito |
|---|---|---|
| “¿Cuánto cuesta el paquete esencial para 150?” | `buscar_paquetes` + `obtener_precio_paquete` | Monto/rango de fila vigente |
| “¿Qué incluye el de XV premium?” | `listar_inclusiones` | Lista tipada, sin mezclar SKUs |
| “¿Mejor el A o el B?” | `comparar_paquetes` | Diff estructurado |
| “¿Hay algo para 20 personas?” | `buscar_paquetes` (aforo) | Vacío → a medida / handoff |
| “¿El menú infantil cuesta X?” | Solo si existe inclusión/precio tipado; si no | Handoff — no inventar |

## 8. Criterio de cierre de este entregable

Modelo de Paquete / Precio / Inclusión / Regla, contrato de tools, reglas de import Excel y separación total respecto a pgvector como fuente de montos, listos para implementación Prisma.
