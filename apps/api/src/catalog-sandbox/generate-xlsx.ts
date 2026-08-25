import { CatalogSnapshotSchema } from "@tres-cielos/shared";
import ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const fixtures = path.resolve(__dirname, "../../../../fixtures/catalog");
  const raw = JSON.parse(
    fs.readFileSync(path.join(fixtures, "golden-snapshot.json"), "utf8"),
  );
  const snapshot = CatalogSnapshotSchema.parse(raw);

  const wb = new ExcelJS.Workbook();

  const paquetes = wb.addWorksheet("Paquetes");
  paquetes.addRow([
    "sku",
    "nombre",
    "tipo_evento",
    "sede",
    "aforo_min",
    "aforo_max",
    "descripcion_corta",
    "estado",
  ]);
  for (const p of snapshot.paquetes) {
    paquetes.addRow([
      p.sku,
      p.nombre,
      p.tipo_evento,
      p.sede,
      p.aforo_min,
      p.aforo_max,
      p.descripcion_corta,
      p.estado,
    ]);
  }

  const precios = wb.addWorksheet("Precios");
  precios.addRow([
    "sku",
    "moneda",
    "monto",
    "rango_min",
    "rango_max",
    "unidad",
    "vigente_desde",
    "vigente_hasta",
    "condiciones",
  ]);
  for (const p of snapshot.precios) {
    precios.addRow([
      p.sku,
      p.moneda,
      p.monto,
      p.rango_min,
      p.rango_max,
      p.unidad,
      p.vigente_desde,
      p.vigente_hasta,
      p.condiciones,
    ]);
  }

  const inclusiones = wb.addWorksheet("Inclusiones");
  inclusiones.addRow([
    "sku",
    "categoria",
    "nombre",
    "cantidad",
    "unidad",
    "obligatoria",
  ]);
  for (const i of snapshot.inclusiones) {
    inclusiones.addRow([
      i.sku,
      i.categoria,
      i.nombre,
      i.cantidad,
      i.unidad,
      i.obligatoria,
    ]);
  }

  const reglas = wb.addWorksheet("Reglas");
  reglas.addRow(["sku", "tipo", "parametros_json", "mensaje_prospecto"]);
  for (const r of snapshot.reglas) {
    reglas.addRow([r.sku, r.tipo, r.parametros_json, r.mensaje_prospecto]);
  }

  const out = path.join(fixtures, "sample-catalog.xlsx");
  await wb.xlsx.writeFile(out);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
