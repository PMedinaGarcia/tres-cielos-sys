import { Injectable } from "@nestjs/common";
import { MIME_ALLOWLIST } from "../contracts/media.types";
import { PdfParser } from "../parsers/pdf.parser";
import type { SourcePlugin, SourcePluginContext, SourcePluginParseResult } from "./source-plugin";

@Injectable()
export class PdfSourcePlugin implements SourcePlugin {
  readonly id = "pdf";

  constructor(private readonly parser: PdfParser) {}

  accepts(input: { mime: string }): boolean {
    return MIME_ALLOWLIST[input.mime] === "pdf";
  }

  async parse(ctx: SourcePluginContext): Promise<SourcePluginParseResult> {
    return { kind: "fragments", fragments: this.parser.parse(ctx.buffer) };
  }
}
