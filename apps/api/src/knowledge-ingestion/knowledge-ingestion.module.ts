import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiProvidersModule } from "../ai-providers/ai-providers.module";
import { RagPipelineModule } from "../rag/rag-pipeline.module";
import { AuthModule } from "../auth/auth.module";
import { resolveRagStore } from "../config/ai-mode";
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
import { PrismaKnowledgeRepository } from "./repository/prisma-knowledge.repository";
import { KNOWLEDGE_REPOSITORY } from "./repository/knowledge.repository";
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
import { KnowledgeCorpusSeedService } from "./knowledge-corpus-seed.service";
import { ConocimientoController } from "./conocimiento.controller";

@Module({
  imports: [AiProvidersModule, RagPipelineModule, AuthModule],
  controllers: [ConocimientoController],
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
    PrismaKnowledgeRepository,
    {
      provide: KNOWLEDGE_REPOSITORY,
      inject: [ConfigService, PrismaKnowledgeRepository, KnowledgeRepositoryStub],
      useFactory: (
        config: ConfigService,
        prismaRepo: PrismaKnowledgeRepository,
        stub: KnowledgeRepositoryStub,
      ) =>
        resolveRagStore(config) === "prisma" ? prismaRepo : stub,
    },
    MediaRouterService,
    PublishArchiveService,
    ChannelAttachmentJobService,
    OcrPriceGateService,
    KnowledgeCorpusSeedService,
  ],
  exports: [
    AiProvidersModule,
    TariffScrubService,
    MediaRouterService,
    PublishArchiveService,
    ChannelAttachmentJobService,
    OcrPriceGateService,
    KnowledgeRepositoryStub,
    KNOWLEDGE_REPOSITORY,
    SlaTrackerService,
    XlsRouter,
    SourcePluginRegistry,
  ],
})
export class KnowledgeIngestionModule {}
