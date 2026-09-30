import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ExpedientePersistService } from "../../crm/expediente-persist.service";
import { ConversationStoreService } from "../stubs/conversation-store.service";

@Injectable()
export class SlaClockService {
  private readonly logger = new Logger(SlaClockService.name);

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly expediente?: ExpedientePersistService,
    @Optional() private readonly store?: ConversationStoreService,
  ) {}

  async processVencidos(now = new Date()): Promise<string[]> {
    if (!this.prisma || !process.env.DATABASE_URL) return [];
    const rows = await this.prisma.conversacion.findMany({
      where: {
        slaVenceEn: { lte: now },
        estadoBot: "escalado",
        asesorLockId: null,
      },
      select: { id: true },
    });
    const ids: string[] = [];
    for (const row of rows) {
      await this.expediente?.persistDevolverABot({
        conversacionId: row.id,
        motivo: "sla_vencido",
      });
      const conv = await this.store?.findById(row.id);
      if (conv) {
        await this.store?.update(row.id, {
          estadoBot: "activo",
          asesorLockId: null,
          slaVenceEn: null,
        });
      }
      ids.push(row.id);
    }
    if (ids.length) {
      this.logger.log(`SLA vencido, retorno a bot: ${ids.join(",")}`);
    }
    return ids;
  }
}
