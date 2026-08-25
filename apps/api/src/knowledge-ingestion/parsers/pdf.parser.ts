import { Injectable } from "@nestjs/common";
import { TariffScrubService } from "../scrub/tariff-scrub.service";
import type { ParsedFragment } from "../contracts/media.types";

/**
 * Extracción liviana de texto PDF (streams / literales).
 * Para CI acepta también buffers UTF-8 etiquetados como PDF.
 */
@Injectable()
export class PdfParser {
  constructor(private readonly scrub: TariffScrubService) {}

  parse(buffer: Buffer): ParsedFragment[] {
    const raw = this.extractText(buffer);
    const scrubbed = this.scrub.scrub(raw);
    const chunks = this.chunk(scrubbed.textoLimpio);
    return chunks.map((texto, orden) => ({
      texto,
      noRecuperablePrecio: scrubbed.noRecuperablePrecio,
      tipoMaterial: "pdf" as const,
      origenDerivacion: "texto_nativo" as const,
      orden,
    }));
  }

  private extractText(buffer: Buffer): string {
    const asUtf8 = buffer.toString("utf8");
    if (!asUtf8.startsWith("%PDF")) {
      return asUtf8;
    }
    const literals: string[] = [];
    const re = /\((?:\\.|[^\\)])*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(asUtf8)) !== null) {
      const inner = m[0]
        .slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\t/g, " ")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (inner.trim().length > 1) literals.push(inner);
    }
    // Fallback: printable runs
    if (literals.length === 0) {
      const runs = asUtf8.match(/[\x20-\x7EÀ-ÿ]{4,}/g) ?? [];
      return runs.join("\n");
    }
    return literals.join("\n");
  }

  private chunk(texto: string, max = 800): string[] {
    if (!texto.trim()) return [];
    const parts: string[] = [];
    let buf = "";
    for (const line of texto.split(/\n+/)) {
      if ((buf + "\n" + line).length > max && buf) {
        parts.push(buf.trim());
        buf = line;
      } else {
        buf = buf ? `${buf}\n${line}` : line;
      }
    }
    if (buf.trim()) parts.push(buf.trim());
    return parts;
  }
}
