import { Injectable } from "@nestjs/common";
import { MIME_ALLOWLIST } from "../contracts/media.types";
import { XlsRouter } from "../parsers/xls.router";
import type { SourcePlugin, SourcePluginContext, SourcePluginParseResult } from "./source-plugin";

@Injectable()
export class XlsSourcePlugin implements SourcePlugin {
  readonly id = "xls";

  constructor(private readonly xls: XlsRouter) {}

  accepts(input: { mime: string }): boolean {
    const tipo = MIME_ALLOWLIST[input.mime];
    return tipo === "xlsx" || tipo === "csv";
  }

  async parse(ctx: SourcePluginContext): Promise<SourcePluginParseResult> {
    const x = await this.xls.route(ctx.buffer);
    if (x.kind === "mixto_revision") {
      return { kind: "rejected", motivo: "requiere_revision_admin" };
    }
    if (x.kind === "catalogo") {
      return { kind: "catalogo", catalogoRows: x.catalogoRows };
    }
    return { kind: "fragments", fragments: x.fragments };
  }
}
