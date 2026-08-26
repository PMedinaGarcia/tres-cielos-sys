# Fixtures de catálogo (sandbox)

Fuente canónica intermedia: `golden-snapshot.json` (Zod `CatalogSnapshot`).
Es el **catálogo que Prisma siembra al chat**: Paquete Estándar (`EVT-J1-TC`) y Upgrade Premium (`EVT-J1-PREMIUM`) de la ficha Bodas 2027, sede Tres Cielos Tequesquitengo. No incluye el golden de prueba `BODA-J1-*` / «Esencial».

Tras cambiar este snapshot hay que re-sembrar:

```bash
pnpm --filter @tres-cielos/api sandbox:xlsx
pnpm --filter @tres-cielos/api sandbox:seed
```

| Archivo | Uso |
|---|---|
| `golden-snapshot.json` | Seed y validación |
| `golden-qa.json` | Eval de tools |
| `csv/*.csv` | Plantillas por hoja |
| `sample-catalog.xlsx` | Generado por `pnpm --filter @tres-cielos/api sandbox:xlsx` |

Ver [docs/setup/08-sandbox-catalogo-xls.md](../../docs/setup/08-sandbox-catalogo-xls.md).

YAML de negocio (misma ficha, campos extra): [`../negocio/ediciones/2026-07/catalog/`](../negocio/ediciones/2026-07/catalog/paquetes.yaml). Guía: [`../../docs/negocio/00-indice.md`](../../docs/negocio/00-indice.md).
