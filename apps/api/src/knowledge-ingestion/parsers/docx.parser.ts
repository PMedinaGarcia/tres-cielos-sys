import { inflateRawSync } from "zlib";
import { Injectable } from "@nestjs/common";
import { TariffScrubService } from "../scrub/tariff-scrub.service";
import type { ParsedFragment } from "../contracts/media.types";

/**
 * Word (.docx = ZIP OOXML). Extrae document.xml sin deps extra.
 * Buffers UTF-8 de prueba también aceptados.
 */
@Injectable()
export class DocxParser {
  constructor(private readonly scrub: TariffScrubService) {}

  parse(buffer: Buffer): ParsedFragment[] {
    const raw = this.extractText(buffer);
    const scrubbed = this.scrub.scrub(raw);
    const chunks = scrubbed.textoLimpio
      ? [scrubbed.textoLimpio]
      : [];
    return chunks.map((texto, orden) => ({
      texto,
      noRecuperablePrecio: scrubbed.noRecuperablePrecio,
      tipoMaterial: "docx" as const,
      origenDerivacion: "texto_nativo" as const,
      orden,
    }));
  }

  private extractText(buffer: Buffer): string {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return buffer.toString("utf8");
    }
    try {
      const xml = this.readZipEntry(buffer, "word/document.xml");
      if (!xml) return "";
      return xml
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<w:br\/>/g, "\n")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    } catch {
      return buffer.toString("utf8");
    }
  }

  /** Local-file-header ZIP reader (stored / deflate). */
  private readZipEntry(buf: Buffer, entryName: string): string | null {
    let offset = 0;
    while (offset + 30 < buf.length) {
      if (buf.readUInt32LE(offset) !== 0x04034b50) break;
      const compression = buf.readUInt16LE(offset + 8);
      const compSize = buf.readUInt32LE(offset + 18);
      const nameLen = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);
      const name = buf
        .subarray(offset + 30, offset + 30 + nameLen)
        .toString("utf8");
      const dataStart = offset + 30 + nameLen + extraLen;
      const data = buf.subarray(dataStart, dataStart + compSize);
      offset = dataStart + compSize;
      if (name !== entryName) continue;
      if (compression === 0) return data.toString("utf8");
      if (compression === 8) return inflateRawSync(data).toString("utf8");
      return null;
    }
    return null;
  }
}
