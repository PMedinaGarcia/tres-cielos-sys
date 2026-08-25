# Inventario K de negocio (extensión Julio 2026)

Contrato de biblioteca documental para el contenido comercial. Amplía [../backend/04-ingesta-conocimiento.md](../backend/04-ingesta-conocimiento.md) §2 **sin retirar** K01–K10.

Los archivos concretos: [`fixtures/negocio/`](../../fixtures/negocio/README.md). Cada uno cumple [`schema/documento.frontmatter.md`](../../fixtures/negocio/schema/documento.frontmatter.md).

## 1. Tabla extendida

| ID | Documento | Tipo | Alcance | Qué cubre este corpus | Estado en repo |
|---|---|---|---|---|---|
| K01 | FAQ general | FAQ | Global | Venue jardín; **no** inventa horarios de visita ni cómo llegar | Evergreen, huecos explícitos |
| K02 | Ficha Jardín 1 | Ficha de sede | Sede 1 | Hechos de locación de las plantillas (capilla, carpa, explanada, suite, Cuernavaca como sede de prueba de menú). No sustituye el fixture de test | Borrador de evidencia `2026-07` |
| K03 | Ficha Jardín 2 | Ficha de sede | Sede 2 | Sin evidencia en las Excel | No creado |
| K04 | Tipos de evento | Narrativa | Global | Tarifas 2027 de paquete = **boda**; renta multi; otras ocasiones → asesor | Evergreen |
| K05 | Apoyo narrativo de paquetes | Narrativa | Por línea | Estándar vs Premium vs renta, **sin montos**; programa 3 días | Edición 2027 overlay |
| K06 | Políticas de reserva / anticipos | Política | Global | Anticipo a la firma, no apartado, negociación por escrito (prosa) | Evergreen |
| K07 | Privacidad | Política | Global | No está en las cotizaciones | No creado |
| K08 | Límites del bot | FAQ operativa | Global | No emite Anexo B, no aparta, no negocia descuento | Evergreen |
| K09 | Safe replies | FAQ | Global | Sin dato / conecto asesor | Evergreen |
| K10 | Diff sedes | Comparativo | Global | No aplica | No creado |
| K11 | Módulos atómicos de inclusión | Módulo | Por módulo | Un concepto = un archivo; alimentan K05 | Edición 2026-07 |
| K12 | Hospedaje y cortesías | Promoción (prosa) | Global | Condiciones de cortesía **sin pesos** | Edición 2026-07 |
| K13 | Upgrades / add-ons | Módulo | Global | Premium es SKU; temporada baja jun–sep sin monto exacto | Edición 2027 |
| K14 | Condiciones comerciales de cotización | Política | Global | Anticipo, liquidar 30 días antes, IVA, tramitología, 11 h / 10 h | Evergreen |

K11 no se publica como un solo blob: cada módulo es un `DocumentoFuente` (o un fragmento ordenado del mismo documento de edición). El `id` de frontmatter es `K11-<slug>`.

## 2. Composición K05

Las fichas de línea **no** reescriben el banquete. Listan `modulos:` y, si hace falta, un párrafo de posicionamiento.

| Ficha | SKU | Módulos |
|---|---|---|
| `lineas/premium.md` | `EVT-J1-PREMIUM` | programa-3-dias + base estándar + table-styling, barra-libre, plafón, sillas/vajilla/banquete/pista premium |
| `lineas/tc.md` | `EVT-J1-TC` | programa-3-dias + base estándar (sin barra libre ni plafón ni table styling) |
| `lineas/renta.md` | `RENTA-J1` | locación 11 h, personal-limpieza, suite, valet, sin planta |

Variantes (vajilla, sillas, proteína, pista) viven **dentro** del módulo con subsecciones `## Variante premium` / `## Variante tc`, no como tres archivos.

## 3. Anti-monto (invariante)

Prohibido en markdown K publicado:

- `$`, `MXN`, `pesos` con cifra, `2280`, `209800`, `30000`, `650`, `1300`, `3000`, `1000`.
- Porcentajes de anticipo o IVA **como cifra** en K si ya están en `reglas.yaml` — K06/K14 pueden decir “anticipo a la firma del contrato, porcentaje según catálogo vigente” y, **excepcionalmente**, K14 puede nombrar las condiciones porque son política de prospecto ya impresa en las tres plantillas. Criterio: K14 es la única prosa autorizada a repetir 20%, 16%, 30 días y 02:00 porque el lead las oye en cotización; el **precio del paquete** jamás.

Remisión canónica: “el monto vigente está en el catálogo de paquetes; un asesor confirma la cotización”.

## 4. Citas

Formato ya definido: `[Fuente: nombre_archivo | tipo: tipo_material]`. Para este corpus, `nombre_archivo` = `id` de frontmatter (ej. `K11-coctel`) y `tipo_material` conceptual `markdown` hasta que se publique como PDF/DOCX.

## 5. Fuera de índice

Igual que ingesta v1, más:

- Excel originales de cotización (PII, fórmulas, celdas de cliente).
- Contratos Anexo B rellenos.
- Costos internos, comisiones, tarifas de hospedaje como si fueran SKU de hotel.
- Creatividades de pauta.
