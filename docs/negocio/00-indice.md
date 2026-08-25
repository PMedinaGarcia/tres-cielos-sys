# Negocio — índice del conocimiento comercial

Fuente de verdad **humana** de lo que Tres Cielos vende, cómo se versiona por temporada y cómo se parte para el bot. El corpus ingestible (YAML + markdown con frontmatter) vive en [`fixtures/negocio/`](../../fixtures/negocio/README.md).

Esta carpeta **no** sustituye el diseño de producto ([../producto/01-diseno-estrategico.md](../producto/01-diseno-estrategico.md)) ni el contrato de catálogo Prisma ([../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md)). Inclusiones: plantillas Julio 2026. **Tarifas de paquete bodas: 2027.**

## Lectura

| Doc | Para qué |
|---|---|
| [01 — Universo comercial](01-universo-comercial.md) | Qué se vende, tres líneas, qué no cotiza el bot |
| [02 — Ediciones y vigencias](02-ediciones-y-vigencias.md) | Relojes (catálogo / cotización / promoción), cómo archivar |
| [03 — Matriz de líneas](03-matriz-lineas.md) | Premium vs TC vs Solo renta (deltas fieles a plantilla) |
| [04 — Inventario K de negocio](04-inventario-k-negocio.md) | Mapeo K01–K16, anti-monto, composición de módulos |
| [05 — Pendientes de validación](05-pendientes-validacion.md) | Renta, sede, aforos intermedios |
| [06 — Tarifas Paquete Bodas 2027](06-tarifas-bodas-2027.md) | Tramos estándar/Premium, temporada baja, pago |

## Corpus máquina

| Ruta | Rol |
|---|---|
| [`fixtures/negocio/manifest.yaml`](../../fixtures/negocio/manifest.yaml) | Única lista publicable (edición activa + evergreen) |
| [`fixtures/negocio/schema/documento.frontmatter.md`](../../fixtures/negocio/schema/documento.frontmatter.md) | Contrato YAML de cada documento K |
| [`fixtures/negocio/ediciones/2026-07/`](../../fixtures/negocio/ediciones/2026-07/_edicion.yaml) | Edición sello Julio 2026 |
| [`fixtures/negocio/ediciones/2026-07/catalog/`](../../fixtures/negocio/ediciones/2026-07/catalog/paquetes.yaml) | Datos duros (precios 2027 publicados; renta en borrador) |

## Regla de oro

- **Montos, ratios, umbrales, vigencias** → capa catálogo (`catalog/*.yaml` → futuro Prisma).
- **Prosa de prospecto** → inventario K, **sin cifras**.
- Una edición de catálogo recuperable a la vez, filtrada por `fecha_evento` (el retrieval aún no filtra por fecha; el corpus ya trae ventanas).

## Cómo versionar una temporada nueva

1. Copiar `fixtures/negocio/ediciones/2026-07/` a `ediciones/AAAA-MM/`.
2. Actualizar `_edicion.yaml` (`id`, `vigente_desde`, `reemplaza`, `fuentes`).
3. Editar solo los módulos o precios que cambian; no reescribir las tres líneas enteras.
4. Los upgrades estacionales son **filas nuevas** en `catalog/promociones.yaml` + prosa en `modulos/upgrades.md`, no un parche al paquete base.
5. Apuntar `manifest.yaml` a la edición activa; archivar la anterior (`estado: archivado`).
6. No commitear Excel de cotización (PII de plantilla). Solo transcripción + `fuente` en frontmatter.

## Fuentes de esta edición

Plantillas Anexo B, hoja `PROPUESTA 1`, aforo de ejemplo 100 personas. No son hojas Paquetes/Precios/Inclusiones del sandbox.

- COTIZACIÓN PAQUETE PREMIUM (JULIO 26)
- COTIZACIÓN PAQUETE TC (JULIO 26)
- COTIZACIÓN SOLO RENTA (JULIO 26)
- Ficha **Tres Cielos \| Paquete Bodas 2027** (tarifas y programa de 3 días)
