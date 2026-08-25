# Contrato de frontmatter — documentos K

Cada markdown bajo `evergreen/` y `ediciones/*/lineas|modulos|cortesias|sede/` empieza con YAML entre `---`. Un job de publicación debe rechazar archivos que no validen este contrato.

## Campos

| Campo | Tipo | Obligatorio | Valores |
|---|---|---|---|
| `id` | string | sí | Único en el corpus. Patrón `Knn` o `Knn-<SLUG>` (ej. `K11-COCTEL`, `K05-PREMIUM`) |
| `inventario` | string | sí | `K01` … `K14` (familia; K11 es la familia de módulos) |
| `tipo` | enum | sí | `faq` \| `ficha_sede` \| `politica` \| `tipos_evento` \| `narrativa_paquete` \| `modulo` \| `promocion` \| `safe_reply` |
| `linea` | enum | sí | `premium` \| `tc` \| `renta` \| `shared` \| `evergreen` |
| `sede` | string \| null | sí | `jardin-1` o `null` (global) |
| `edicion` | string \| `evergreen` | sí | `2026-07` o `evergreen` |
| `vigente_desde` | date ISO | sí | Inclusive |
| `vigente_hasta` | date ISO \| null | sí | `null` = abierta |
| `reemplaza` | string \| null | sí | `id` anterior o `null` |
| `estado` | enum | sí | `borrador` \| `publicado` \| `archivado` |
| `sin_montos` | boolean | sí | Debe ser `true` en todo markdown K |
| `sku_refs` | string[] | sí | SKUs relacionados; `[]` si no aplica |
| `modulos` | string[] | no | Solo K05: slugs de `modulos/*.md` (sin `.md`) |
| `variantes` | string[] | no | Subsecciones que el retrieval debe conocer (`premium`, `tc`, `renta`) |
| `fuente` | string | sí | Slug de plantilla o `sintetico-hueco` |
| `titulo` | string | sí | Título de cita humana |

## Ejemplo

```yaml
---
id: K11-COCTEL
inventario: K11
tipo: modulo
linea: shared
sede: jardin-1
edicion: "2026-07"
vigente_desde: 2026-07-01
vigente_hasta: null
reemplaza: null
estado: publicado
sin_montos: true
sku_refs: [EVT-J1-PREMIUM, EVT-J1-TC]
variantes: []
fuente: plantilla-cotizacion-premium-tc-julio-2026
titulo: Cóctel de bienvenida
---
```

## Cuerpo

- Español, prospecto. Sin `$`, sin montos, sin SKU como tarifa.
- Variantes en headings `## Variante premium` / `## Variante tc` / `## Variante renta`.
- Remisión a catálogo: “el detalle numérico vigente está en el catálogo de paquetes”.
- Un módulo = un concepto. No mezclar banquete con pista.

## Relación con Prisma `TipoDocumentoFuente`

| `tipo` corpus | Enum actual / nota |
|---|---|
| `faq` | `faq` |
| `ficha_sede` | `ficha_sede` |
| `politica` | `politica` |
| `tipos_evento` | `tipos_evento` |
| `safe_reply` | `safe_reply` |
| `narrativa_paquete` | `otro` hasta extender enum |
| `modulo` | `otro` |
| `promocion` | `otro` (montos en tabla Promoción futura, no aquí) |
