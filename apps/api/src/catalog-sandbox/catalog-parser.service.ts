import { Injectable } from "@nestjs/common";
import {
  CatalogSnapshot,
  CatalogSnapshotSchema,
} from "@tres-cielos/shared";
import ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";

function fixturesRoot(): string {
  return path.resolve(__dirname, "../../../../fixtures/catalog");
}

function sheetToObjects(sheet: ExcelJS.Worksheet): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, col) => {
    headers[col] = String(cell.value ?? "").trim();
  });
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    let empty = true;
    headers.forEach((h, col) => {
      if (!h) return;
      const raw = row.getCell(col).value;
      const val =
        raw && typeof raw === "object" && "text" in (raw as object)
          ? (raw as { text: string }).text
          : raw;
      if (val !== null && val !== undefined && val !== "") empty = false;
      obj[h] = val === undefined || val === "" ? null : val;
    });
    if (!empty) rows.push(obj);
  });
  return rows;
}

@Injectable()
export class CatalogParserService {
  loadGoldenSnapshot(): CatalogSnapshot {
    const file = path.join(fixturesRoot(), "golden-snapshot.json");
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return CatalogSnapshotSchema.parse(raw);
  }

  async parseXlsx(filePath: string): Promise<CatalogSnapshot> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const paquetes = sheetToObjects(workbook.getWorksheet("Paquetes")!);
    const precios = sheetToObjects(workbook.getWorksheet("Precios")!);
    const inclusiones = sheetToObjects(workbook.getWorksheet("Inclusiones")!);
    const reglasSheet = workbook.getWorksheet("Reglas");
    const reglas = reglasSheet ? sheetToObjects(reglasSheet) : [];
    return CatalogSnapshotSchema.parse({
      paquetes,
      precios,
      inclusiones,
      reglas,
    });
  }

  fixturesRoot(): string {
    return fixturesRoot();
  }
}
