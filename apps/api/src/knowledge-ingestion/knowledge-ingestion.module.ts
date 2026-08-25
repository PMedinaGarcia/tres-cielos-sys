import { Module } from "@nestjs/common";
import { AiProvidersModule } from "../ai-providers/ai-providers.module";
import { RagPipelineModule } from "../rag/rag-pipeline.module";
import { TariffScrubService } from "./scrub/tariff-scrub.service";
import { PdfParser } from "./parsers/pdf.parser";
import { DocxParser } from "./parsers/docx.parser";
import { XlsRouter } from "./parsers/xls.router";
import { PhotoPipeline } from "./parsers/photo.pipeline";
import { VideoPipeline } from "./parsers/video.pipeline";
import { MediaRouterService } from "./media-router.service";
import { SlaTrackerService } from "./jobs/sla-tracker.service";
import { PublishArchiveService } from "./jobs/publish-archive.service";
import { ChannelAttachmentJobService } from "./jobs/channel-attachment-job.service";
import { KnowledgeRepositoryStub } from "./repository/knowledge.repository.stub";
import { OcrPriceGateService } from "./ocr-price-gate.service";
import { PdfSourcePlugin } from "./plugins/pdf.source-plugin";
import { DocxSourcePlugin } from "./plugins/docx.source-plugin";
import { XlsSourcePlugin } from "./plugins/xls.source-plugin";
import { PhotoSourcePlugin } from "./plugins/photo.source-plugin";
import { VideoSourcePlugin } from "./plugins/video.source-plugin";
import {
  SOURCE_PLUGINS,
  SourcePluginRegistry,
} from "./plugins/source-plugin.registry";

/**
 * KnowledgeIngestionModule — Fase E.
 * Ampliar indexado: nuevo SourcePlugin + entrada en SOURCE_PLUGINS / corpus-inventory.json.
 */
@Module({
  imports: [AiProvidersModule, RagPipelineModule],
  providers: [
    TariffScrubService,
    PdfParser,
    DocxParser,
    XlsRouter,
    PhotoPipeline,
    VideoPipeline,
    PdfSourcePlugin,
    DocxSourcePlugin,
    XlsSourcePlugin,
    PhotoSourcePlugin,
    VideoSourcePlugin,
    {
      provide: SOURCE_PLUGINS,
      useFactory: (
        pdf: PdfSourcePlugin,
        docx: DocxSourcePlugin,
        xls: XlsSourcePlugin,
        photo: PhotoSourcePlugin,
        video: VideoSourcePlugin,
      ) => [pdf, docx, xls, photo, video],
      inject: [
        PdfSourcePlugin,
        DocxSourcePlugin,
        XlsSourcePlugin,
        PhotoSourcePlugin,
        VideoSourcePlugin,
      ],
    },
    SourcePluginRegistry,
    SlaTrackerService,
    KnowledgeRepositoryStub,
    MediaRouterService,
    PublishArchiveService,
    ChannelAttachmentJobService,
    OcrPriceGateService,
  ],
  exports: [
    AiProvidersModule,
    TariffScrubService,
    MediaRouterService,
    PublishArchiveService,
    ChannelAttachmentJobService,
    OcrPriceGateService,
    KnowledgeRepositoryStub,
    SlaTrackerService,
    XlsRouter,
    SourcePluginRegistry,
  ],
})
export class KnowledgeIngestionModule {}
