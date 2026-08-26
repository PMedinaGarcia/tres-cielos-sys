import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SEDE_ID } from "@tres-cielos/shared";
import { resolveRagStore } from "../config/ai-mode";
import { buildKnowledgeFixtures } from "../rag/fixtures/knowledge-fixtures";
import { passesHardFilters } from "../rag/in-memory-fragment.repository";
import { PublishArchiveService } from "./jobs/publish-archive.service";
import {
  KNOWLEDGE_REPOSITORY,
  type KnowledgeRepository,
} from "./repository/knowledge.repository";

const SEED_DOCS: Array<{
  inventarioId: string;
  titulo: string;
  nombreArchivo: string;
  sedeId?: string;
}> = [
  {
    inventarioId: "K01",
    titulo: "K01 FAQ general Tres Cielos",
    nombreArchivo: "K01-faq-general.pdf",
  },
  {
    inventarioId: "K02",
    titulo: "K02 Ficha Tres Cielos Tequesquitengo",
    nombreArchivo: "K02-ficha-tequesquitengo.docx",
    sedeId: SEDE_ID,
  },
  {
    inventarioId: "K08",
    titulo: "K08 Escalación y límites del bot",
    nombreArchivo: "K08-limites-bot.pdf",
  },
  {
    inventarioId: "K09",
    titulo: "K09 Plantillas de respuesta safe",
    nombreArchivo: "K09-plantillas-safe.pdf",
  },
];

@Injectable()
export class KnowledgeCorpusSeedService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeCorpusSeedService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly publish: PublishArchiveService,
    @Inject(KNOWLEDGE_REPOSITORY) private readonly repo: KnowledgeRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    if (resolveRagStore(this.config) !== "prisma") return;
    const fixtures = buildKnowledgeFixtures().filter((f) =>
      passesHardFilters(f, { sedeId: f.sedeId }),
    );
    for (const spec of SEED_DOCS) {
      try {
        if (await this.repo.hasPublishedInventario(spec.inventarioId)) continue;
        const texts = fixtures
          .filter((f) => f.inventarioId === spec.inventarioId)
          .map((f) => f.texto);
        if (texts.length === 0) continue;
        await this.publish.publish({
          titulo: spec.titulo,
          mime: "application/pdf",
          buffer: Buffer.from(texts.join("\n\n"), "utf8"),
          nombreArchivo: spec.nombreArchivo,
          sedeId: spec.sedeId,
          inventarioId: spec.inventarioId,
        });
        this.logger.log(`seed inventario ${spec.inventarioId}`);
      } catch (err) {
        this.logger.warn(`seed ${spec.inventarioId} omitido: ${String(err)}`);
      }
    }
  }
}
