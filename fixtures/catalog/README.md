# Fixtures de catálogo (sandbox)

Fuente canónica intermedia: `golden-snapshot.json` (Zod `CatalogSnapshot`).

| Archivo | Uso |
|---|---|
| `golden-snapshot.json` | Seed y validación |
| `golden-qa.json` | Eval de tools |
| `csv/*.csv` | Plantillas por hoja |
| `sample-catalog.xlsx` | Generado por `pnpm --filter @tres-cielos/api sandbox:xlsx` |

Ver [docs/setup/08-sandbox-catalogo-xls.md](../../docs/setup/08-sandbox-catalogo-xls.md).

Catálogo comercial real (tarifas Paquete Bodas **2027** publicadas; renta en borrador): [`../negocio/ediciones/2026-07/catalog/`](../negocio/ediciones/2026-07/catalog/paquetes.yaml). No sustituye este golden snapshot de tests. Guía: [`../../docs/negocio/00-indice.md`](../../docs/negocio/00-indice.md).
