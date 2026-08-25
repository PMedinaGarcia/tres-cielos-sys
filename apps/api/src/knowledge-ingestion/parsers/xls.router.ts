import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { TariffScrubService } from "../scrub/tariff-scrub.service";
import type { ParsedFragment } from "../contracts/media.types";

export type XlsRouteKind = "catalogo" | "narrativa" | "mixto_revision";

export interface XlsRouteResult {
  kind: XlsRouteKind;
  catalogoRows?: Record<string, unknown>[];
  fragments: ParsedFragment[];
  requiereRevisionAdmin: boolean;
}

const CATALOG_SHEETS = new Set([
  "paquetes",
  "precios",
  "inclusiones",
  "reglas",
]);

const NARRATIVE_SHEETS = new Set(["faq", "narrativa", "politicas", "k05"]);

/**
 * XLS split: catálogo Prisma vs narrativa (nunca montos a pgvector).
 */
@Injectable()
export class XlsRouter {
  constructor(private readonly scrub: TariffScrubService) {}

  async route(buffer: Buffer): Promise<XlsRouteResult> {
    // CSV / texto plano de prueba
    const asText = buffer.toString("utf8");
    if (!this.looksLikeZip(buffer) && asText.includes(",")) {
      return this.routeCsv(asText);
    }

    const workbook = new ExcelJS.Workbook();
    // exceljs tipado estricto vs Buffer Node 22
    await workbook.xlsx.load(buffer as never);

    const catalogRows: Record<string, unknown>[] = [];
    const narrativeTexts: string[] = [];
    let hasCatalog = false;
    let hasNarrative = false;
    let ambiguous = false;

    workbook.eachSheet((sheet) => {
      const name = sheet.name.trim().toLowerCase();
      const rows = sheetToObjects(sheet);
      if (CATALOG_SHEETS.has(name)) {
        hasCatalog = true;
        catalogRows.push(
          ...rows.map((r) => ({ ...r, __sheet: sheet.name })),
        );
        return;
      }
      if (NARRATIVE_SHEETS.has(name)) {
        hasNarrative = true;
        for (const r of rows) {
          const prosa = Object.values(r)
            .filter((v) => typeof v === "string")
            .join(" ");
          narrativeTexts.push(prosa);
        }
        return;
      }
      // Hoja mixta / desconocida
      const joined = JSON.stringify(rows).toLowerCase();
      if (/precio|monto|sku|paquete/.test(joined)) {
        if (/faq|horario|política|politica|descripción|descripcion/.test(joined)) {
          ambiguous = true;
        } else {
          hasCatalog = true;
          catalogRows.push(...rows.map((r) => ({ ...r, __sheet: sheet.name })));
        }
      } else {
        hasNarrative = true;
        narrativeTexts.push(
          rows
            .map((r) => Object.values(r).filter((v) => typeof v === "string").join(" "))
            .join("\n"),
        );
      }
    });

    if (ambiguous || (hasCatalog && hasNarrative && catalogRows.length === 0)) {
      return {
        kind: "mixto_revision",
        fragments: [],
        requiereRevisionAdmin: true,
      };
    }

    if (hasCatalog && !hasNarrative) {
      return {
        kind: "catalogo",
        catalogoRows: catalogRows,
        fragments: [],
        requiereRevisionAdmin: false,
      };
    }

    const fragments = this.toNarrativeFragments(narrativeTexts);
    return {
      kind: "narrativa",
      fragments,
      requiereRevisionAdmin: false,
      ...(hasCatalog ? { catalogoRows: catalogRows } : {}),
    };
  }

  private routeCsv(text: string): XlsRouteResult {
    const lower = text.toLowerCase();
    if (/sku|precio|monto|paquete/.test(lower) && !/faq|horario/.test(lower)) {
      const lines = text.trim().split(/\r?\n/);
      const headers = lines[0]?.split(",") ?? [];
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(",");
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          obj[h.trim()] = cols[i]?.trim() ?? null;
        });
        return obj;
      });
      return {
        kind: "catalogo",
        catalogoRows: rows,
        fragments: [],
        requiereRevisionAdmin: false,
      };
    }
    return {
      kind: "narrativa",
      fragments: this.toNarrativeFragments([text]),
      requiereRevisionAdmin: false,
    };
  }

  private toNarrativeFragments(texts: string[]): ParsedFragment[] {
    const fragments: ParsedFragment[] = [];
    let orden = 0;
    for (const t of texts) {
      const scrubbed = this.scrub.scrub(t);
      // Narrativa sin montos (K05); si había montos, flag + texto limpio
      if (!scrubbed.textoLimpio.trim()) continue;
      fragments.push({
        texto: scrubbed.textoLimpio,
        noRecuperablePrecio: scrubbed.noRecuperablePrecio,
        tipoMaterial: "xlsx",
        origenDerivacion: "xls_narrativo",
        orden: orden++,
      });
    }
    return fragments;
  }

  private looksLikeZip(buf: Buffer): boolean {
    return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
  }
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
