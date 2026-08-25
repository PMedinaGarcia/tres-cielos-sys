# Ediciones y vigencias

Cómo se almacena el conocimiento para que promociones, épocas y caducidad no contaminen respuestas viejas. El patrón de ventana ya existe en `PaquetePrecio.vigenteDesde` / `vigenteHasta` ([../database/02-catalogo-paquetes.md](../database/02-catalogo-paquetes.md)); el corpus de negocio lo replica en documentos y promociones **antes** de que Prisma lo tenga.

## 1. Tres relojes (no mezclar)

Las plantillas Julio 2026 mezclan en un solo PDF/Excel tres relojes distintos. El corpus los separa.

| Reloj | Qué mide | Dónde vive | Ejemplo Julio 2026 |
|---|---|---|---|
| **Edición de catálogo** | Temporada comercial de SKUs, inclusiones y copy de línea | `_edicion.yaml`, frontmatter `edicion` + `vigente_desde` / `vigente_hasta` | Sello de archivo “JULIO 26” → edición `2026-07`, `vigente_desde: 2026-07-01` |
| **Cotización emitida** | Cuánto tiempo vale **esa** propuesta firmable | K14 + regla `vigencia_cotizacion_dias` | 30 días naturales desde `FECHA COTIZACIÓN` |
| **Promoción** | Add-on o cortesía con ventana propia | `catalog/promociones.yaml` + K12/K13 | Cortesías de hospedaje ancladas a “tarifa 2027”; un upgrade de temporada alta |

Una cotización puede caducar a los 30 días **sin** que el SKU deje de estar vigente en catálogo. Una promoción puede morir en agosto **sin** archivar el Paquete Premium.

## 2. Ciclo de una edición

```
borrador (transcripción / validación Tres Cielos)
    → publicado (manifest apunta aquí; bot/tools solo esto)
         → archivado (exclusión inmediata; se conserva historial)
```

Reglas:

- `manifest.yaml` es la **única** lista que un job de publicación recorrería.
- Filtro conceptual: `estado = publicado` y `vigente_desde <= fecha_consulta <= vigente_hasta` (si `vigente_hasta` es null, abierta).
- `fecha_consulta` = `fecha_evento` del brief si existe; si no, `now`.
- Al publicar la edición `AAAA-MM`, la anterior pasa a `archivado` en el manifest. No se borran archivos.
- Frontmatter `reemplaza:` apunta al `id` de la edición o documento anterior.

Hoy el hybrid search **no** recibe `fechaEvento` y las tools de catálogo usan `now()`. El corpus ya trae las ventanas para cuando exista ese filtro. Hasta entonces: no publicar dos ediciones a la vez en el índice activo.

## 3. Qué cambia con una temporada (y qué no)

| Cambia a menudo | Cambia poco (evergreen) | Nunca al vector como monto |
|---|---|---|
| Precio pp / renta | Condiciones tipo “no aparta fecha” | Cualquier `$` |
| Menú (proteína, tornaboda) | Límites del bot (K08) | Anticipo % (sí va a regla Prisma) |
| Upgrades y cortesías | Safe replies (K09) | Presupuesto floral |
| Copy de línea (K05) | Privacidad (K07) cuando exista | Umbral 209 800 / 30 000 pp |

Procedimiento de upgrade estacional:

1. **No** editar la lista de inclusiones base del SKU.
2. Añadir fila en `promociones.yaml` con `vigente_desde` / `vigente_hasta`, `sku_aplica` y `estado`.
3. Una viñeta en `modulos/upgrades.md` **sin montos** (“consulta el catálogo vigente”).
4. Al vencer: `estado: archivado` en la promoción; el módulo upgrades puede quedar con “no hay add-ons vigentes”.

## 4. Extensiones de schema recomendadas (no implementadas aquí)

El patrón a copiar es `PaquetePrecio`. Faltaría:

1. `DocumentoFuente.vigenteDesde` / `vigenteHasta` (y/o en `FragmentoVectorial`) para que un K de “menú verano” no se recupere en diciembre.
2. Filtro de hybrid search por `fechaEvento`.
3. Entidad `Promocion` (cortesía, upgrade, descuento catalogado) con ventana; el handoff `descuento_fuera_catalogo` solo si **no** hay fila vigente.
4. Tools `buscar_paquetes` / `obtener_precio_paquete`: honrar el argumento `fecha` del evento, no solo `now()`.
5. Inclusiones y reglas con vigencia opcional (menú de temporada sin reescribir el paquete).
6. Ligar `DocumentoFuente` a `codigoSku` y a `edicion`.

Hasta que existan, el gobierno es **manual vía manifest**: una edición publicada, promociones en YAML, RAG fixtures de test intocados.

## 5. Metadatos de la edición 2026-07

Ver [`fixtures/negocio/ediciones/2026-07/_edicion.yaml`](../../fixtures/negocio/ediciones/2026-07/_edicion.yaml).

- `vigente_hasta` de **tarifas de paquete bodas**: 2027-12-31. Precios por tramo en `precios.yaml`, `estado: publicado`, `confianza: ficha-bodas-2027`.
- Placeholder $2,280 de plantilla: `estado: archivado`.
- Renta $0: sigue `borrador`.
- Temporada baja junio–septiembre: promoción `TEMPORADA-BAJA-JUN-SEP` (descuento *desde* $30,000; monto exacto → asesor).
- Liquidación: 30 días **antes del evento** (distinto de la vigencia de 30 días de la cotización).

## 6. Invalidación (contrato ya escrito en ingesta)

Al publicar conocimiento: nueva versión, fragmentos nuevos, desactivar los de la versión anterior, SLA &lt; 60 s en texto. Detalle: [../backend/04-ingesta-conocimiento.md](../backend/04-ingesta-conocimiento.md) §5.

Al publicar precio: no pasa por embeddings; la siguiente tool debe devolver el valor nuevo post-commit.
