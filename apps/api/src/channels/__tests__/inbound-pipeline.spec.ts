import { ConversationStateStore } from "../conversation-state.store";
import { IdempotencyService } from "../idempotency.service";
import { OutboundService } from "../outbound.service";
import { AuditService } from "../../audit/audit.service";
import { QuotaService } from "../../quota/quota.service";
import { CrmCalificacionService } from "../../crm/calificacion.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { AssignmentService } from "../../assignment/assignment.service";
import { ChannelAttachmentService } from "../attachments/channel-attachment.service";
import { ChannelAttachmentJobService } from "../../knowledge-ingestion/jobs/channel-attachment-job.service";
import { InboundPipelineService } from "../inbound-pipeline.service";
import type { TurnHandler } from "../turn-handler";
import type { InboundMessage } from "../types/inbound-message";
import { buildTestMediaRouter } from "../../knowledge-ingestion/__tests__/build-test-media-router";

function buildMedia() {
  return buildTestMediaRouter();
}

describe("D-BOT-6 silencio humano", () => {
  it("estado_bot=humano → ruta silencio sin reply", async () => {
    const store = new ConversationStateStore();
    const handler: TurnHandler = {
      async handleTurn() {
        throw new Error("no debe llamarse");
      },
    };
    const pipeline = new InboundPipelineService(
      new IdempotencyService(),
      new OutboundService(),
      store,
      new ChannelAttachmentService(new ChannelAttachmentJobService(buildMedia())),
      new AuditService(),
      new QuotaService(),
      new CrmCalificacionService(),
      new NotificationsService(),
      new AssignmentService(),
      handler,
    );

    const conv = store.getOrCreate("whatsapp", "wa:+52000");
    store.setEstadoBot(conv.id, "humano");

    const msg: InboundMessage = {
      canal: "whatsapp",
      externalThreadId: "wa:+52000",
      externalMessageId: "SM-silence",
      texto: "hola",
      recibidoEn: new Date().toISOString(),
    };
    const result = await pipeline.process(msg);
    expect("duplicate" in result).toBe(false);
    if (!("duplicate" in result)) {
      expect(result.ruta).toBe("silencio");
      expect(result.silencio).toBe(true);
    }
  });
});

describe("Cupo hard → cupo_ia", () => {
  it("handoff cupo_ia", async () => {
    process.env.QUOTA_MSG_HARD = "1";
    process.env.QUOTA_MSG_SOFT = "1";
    const quota = new QuotaService();
    quota.setUsage("default", 1, 0);
    const pipeline = new InboundPipelineService(
      new IdempotencyService(),
      new OutboundService(),
      new ConversationStateStore(),
      new ChannelAttachmentService(new ChannelAttachmentJobService(buildMedia())),
      new AuditService(),
      quota,
      new CrmCalificacionService(),
      new NotificationsService(),
      new AssignmentService(),
      {
        async handleTurn() {
          return {
            textoRespuesta: "no",
            ruta: "guion",
            estadoBot: "activo",
          };
        },
      },
    );

    const result = await pipeline.process({
      canal: "whatsapp",
      externalThreadId: "wa:+521",
      externalMessageId: "SM-cupo",
      texto: "hola",
      recibidoEn: new Date().toISOString(),
    });
    expect("duplicate" in result).toBe(false);
    if (!("duplicate" in result)) {
      expect(result.motivoHandoff).toBe("cupo_ia");
      expect(result.estadoBot).toBe("escalado");
    }
  });
});

describe("cola por hilo", () => {
  it("procesa dos mensajes del mismo hilo en orden", async () => {
    delete process.env.QUOTA_MSG_HARD;
    delete process.env.QUOTA_MSG_SOFT;
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const handler: TurnHandler = {
      async handleTurn(msg) {
        order.push(`start:${msg.externalMessageId}`);
        if (msg.externalMessageId === "m1") await gate;
        order.push(`end:${msg.externalMessageId}`);
        return {
          textoRespuesta: "ok",
          ruta: "guion",
          estadoBot: "activo",
        };
      },
    };
    const pipeline = new InboundPipelineService(
      new IdempotencyService(),
      new OutboundService(),
      new ConversationStateStore(),
      new ChannelAttachmentService(new ChannelAttachmentJobService(buildMedia())),
      new AuditService(),
      new QuotaService(),
      new CrmCalificacionService(),
      new NotificationsService(),
      new AssignmentService(),
      handler,
    );
    const base = {
      canal: "whatsapp" as const,
      externalThreadId: "wa:+525512345678",
      texto: "hola",
      recibidoEn: new Date().toISOString(),
    };
    const first = pipeline.process({ ...base, externalMessageId: "m1" });
    const second = pipeline.process({ ...base, externalMessageId: "m2" });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(order).toEqual(["start:m1"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["start:m1", "end:m1", "start:m2", "end:m2"]);
  });
});
