import type { ParsedFragment, TipoMaterial } from "../contracts/media.types";

export interface SourcePluginContext {
  buffer: Buffer;
  mime: string;
  nombreArchivo?: string;
  storageKey: string;
  signedUrl?: string;
  duracionMs?: number;
}

export type SourcePluginParseResult =
  | { kind: "fragments"; fragments: ParsedFragment[] }
  | { kind: "catalogo"; catalogoRows: unknown }
  | { kind: "rejected"; motivo: string };

export interface SourcePlugin {
  /** Identificador estable (pdf, docx, xls, photo, video, …). */
  id: string;
  accepts(input: { mime: string; tipo?: TipoMaterial }): boolean;
  parse(ctx: SourcePluginContext): Promise<SourcePluginParseResult>;
  defaultScope?: { inventarioId?: string };
}
