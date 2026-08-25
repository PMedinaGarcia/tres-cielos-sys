import { Inject, Injectable, Optional } from "@nestjs/common";
import type { SourcePlugin } from "./source-plugin";
import { PdfSourcePlugin } from "./pdf.source-plugin";
import { DocxSourcePlugin } from "./docx.source-plugin";
import { XlsSourcePlugin } from "./xls.source-plugin";
import { PhotoSourcePlugin } from "./photo.source-plugin";
import { VideoSourcePlugin } from "./video.source-plugin";
import { PdfParser } from "../parsers/pdf.parser";
import { DocxParser } from "../parsers/docx.parser";
import { XlsRouter } from "../parsers/xls.router";
import { PhotoPipeline } from "../parsers/photo.pipeline";
import { VideoPipeline } from "../parsers/video.pipeline";

export const SOURCE_PLUGINS = "SOURCE_PLUGINS";

/** Ampliar indexado = registrar un plugin aquí (o vía SOURCE_PLUGINS). */
export function assembleSourcePlugins(parsers: {
  pdf: PdfParser;
  docx: DocxParser;
  xls: XlsRouter;
  photo: PhotoPipeline;
  video: VideoPipeline;
}): SourcePlugin[] {
  return [
    new PdfSourcePlugin(parsers.pdf),
    new DocxSourcePlugin(parsers.docx),
    new XlsSourcePlugin(parsers.xls),
    new PhotoSourcePlugin(parsers.photo),
    new VideoSourcePlugin(parsers.video),
  ];
}

@Injectable()
export class SourcePluginRegistry {
  private readonly plugins: SourcePlugin[];

  constructor(
    @Optional() @Inject(SOURCE_PLUGINS) injected?: SourcePlugin[],
  ) {
    this.plugins = injected ?? [];
  }

  resolve(mime: string): SourcePlugin | undefined {
    return this.plugins.find((p) => p.accepts({ mime }));
  }

  list(): SourcePlugin[] {
    return [...this.plugins];
  }
}
