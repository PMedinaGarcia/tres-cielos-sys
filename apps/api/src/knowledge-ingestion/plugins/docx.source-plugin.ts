import { Injectable } from "@nestjs/common";
import { MIME_ALLOWLIST } from "../contracts/media.types";
import { DocxParser } from "../parsers/docx.parser";
import type { SourcePlugin, SourcePluginContext, SourcePluginParseResult } from "./source-plugin";

@Injectable()
export class DocxSourcePlugin implements SourcePlugin {
  readonly id = "docx";

  constructor(private readonly parser: DocxParser) {}

  accepts(input: { mime: string }): boolean {
    return MIME_ALLOWLIST[input.mime] === "docx";
  }

  async parse(ctx: SourcePluginContext): Promise<SourcePluginParseResult> {
    return { kind: "fragments", fragments: this.parser.parse(ctx.buffer) };
  }
}
