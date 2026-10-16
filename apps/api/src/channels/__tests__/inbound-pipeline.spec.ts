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
import { SAFE_COPY_BOT_SILENCIADO } from "../../conversation/handoff/safe-copy";
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

  it("avisa una sola vez y no después de un mensaje del asesor", async () => {
    const prevDb = process.env.DATABASE_URL;
    const prevHard = process.env.QUOTA_MSG_HARD;
    const prevSid = process.env.TWILIO_ACCOUNT_SID;
    process.env.DATABASE_URL = "postgresql://test";
    delete process.env.QUOTA_MSG_HARD;
    delete process.env.TWILIO_ACCOUNT_SID;
    const salientes: Array<{ autor: string; contenido: string }> = [];
    const prisma = {
      mensaje: {
        findFirst: jest.fn(async () => salientes.at(-1) ?? null),
        create: jest.fn(async (args: { data: { autor: string; contenido: string } }) => {
          salientes.push(args.data);
          return args.data;
        }),
      },
    };
    const store = new ConversationStateStore();
    const outbound = new OutboundService();
    const conv = store.getOrCreate("whatsapp", "wa:+52000");
    conv.id = "c1";
    store.setEstadoBot("c1", "humano");
    const pipeline = new InboundPipelineService(
      new IdempotencyService(),
      outbound,
      store,
      new ChannelAttachmentService(new ChannelAttachmentJobService(buildMedia())),
      new AuditService(),
      new QuotaService(),
      new CrmCalificacionService(),
      new NotificationsService(),
      new AssignmentService(),
      {
        async handleTurn() {
          throw new Error("no debe llamarse");
        },
      },
      undefined,
      prisma as never,
    );
    const msg = (id: string): InboundMessage => ({
      canal: "whatsapp",
      externalThreadId: "wa:+52000",
      externalMessageId: id,
      texto: "sigo aquí",
      recibidoEn: new Date().toISOString(),
    });
    try {
      await pipeline.process(msg("m1"));
      expect(outbound.drain().map((m) => m.texto)).toEqual([SAFE_COPY_BOT_SILENCIADO]);
      await pipeline.process(msg("m2"));
      expect(outbound.drain()).toEqual([]);
      salientes.push({ autor: "asesor", contenido: "Hola, soy el asesor" });
      await pipeline.process(msg("m3"));
      expect(outbound.drain()).toEqual([]);
      expect(prisma.mensaje.create).toHaveBeenCalledTimes(1);
    } finally {
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
      if (prevHard === undefined) delete process.env.QUOTA_MSG_HARD;
      else process.env.QUOTA_MSG_HARD = prevHard;
      if (prevSid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
      else process.env.TWILIO_ACCOUNT_SID = prevSid;
    }
  });
});

describe("RAG en espera no se solapa con el asesor", () => {
  function pipelineCon(
    store: ConversationStateStore,
    outbound: OutboundService,
    handler: TurnHandler,
    prisma?: { mensaje: { findFirst: jest.Mock; create: jest.Mock } },
  ) {
    return new InboundPipelineService(
      new IdempotencyService(),
      outbound,
      store,
      new ChannelAttachmentService(new ChannelAttachmentJobService(buildMedia())),
      new AuditService(),
      new QuotaService(),
      new CrmCalificacionService(),
      new NotificationsService(),
      new AssignmentService(),
      handler,
      undefined,
      prisma as never,
    );
  }

  it("mientras nadie tomó el hilo, la duda sale; después del asesor, no", async () => {
    const prevDb = process.env.DATABASE_URL;
    const prevHard = process.env.QUOTA_MSG_HARD;
    process.env.DATABASE_URL = "postgresql://test";
    delete process.env.QUOTA_MSG_HARD;
    const salientes: Array<{ autor: string; contenido: string }> = [];
    const prisma = {
      mensaje: {
        findFirst: jest.fn(async () => salientes.at(-1) ?? null),
        create: jest.fn(async (args: { data: { autor: string; contenido: string } }) => {
          salientes.push(args.data);
          return args.data;
        }),
      },
    };
    const store = new ConversationStateStore();
    const outbound = new OutboundService();
    const conv = store.getOrCreate("whatsapp", "wa:+52900");
    conv.id = "c-asesor";
    store.setEstadoBot("c-asesor", "escalado");
    let turnos = 0;
    const pipeline = pipelineCon(
      store,
      outbound,
      {
        async handleTurn() {
          turnos += 1;
          return {
            textoRespuesta: "El jardín tiene capilla.",
            ruta: "rag",
            estadoBot: "escalado",
          };
        },
      },
      prisma,
    );
    const msg = (id: string): InboundMessage => ({
      canal: "whatsapp",
      externalThreadId: "wa:+52900",
      externalMessageId: id,
      texto: "tienen capilla",
      recibidoEn: new Date().toISOString(),
    });
    try {
      const antes = await pipeline.process(msg("antes"));
      expect(antes).toMatchObject({ ruta: "rag", textoRespuesta: "El jardín tiene capilla." });
      expect(outbound.drain().map((m) => m.texto)).toEqual(["El jardín tiene capilla."]);

      store.setEstadoBot("c-asesor", "humano");
      salientes.push({ autor: "asesor", contenido: "Hola, te atiendo yo" });

      const despues = await pipeline.process(msg("despues"));
      expect(despues).toMatchObject({
        ruta: "silencio",
        silencio: true,
        estadoBot: "humano",
        textoRespuesta: "",
      });
      expect(turnos).toBe(1);
      expect(outbound.drain()).toEqual([]);
    } finally {
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
      if (prevHard === undefined) delete process.env.QUOTA_MSG_HARD;
      else process.env.QUOTA_MSG_HARD = prevHard;
    }
  });

  it("si el asesor toma el hilo mientras el bot arma el RAG, esa respuesta no se envía", async () => {
    delete process.env.QUOTA_MSG_HARD;
    delete process.env.QUOTA_MSG_SOFT;
    const store = new ConversationStateStore();
    const outbound = new OutboundService();
    const conv = store.getOrCreate("whatsapp", "wa:+52901");
    store.setEstadoBot(conv.id, "escalado");
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entro = false;
    const pipeline = pipelineCon(store, outbound, {
      async handleTurn() {
        entro = true;
        await gate;
        return {
          textoRespuesta: "El jardín tiene capilla.",
          ruta: "rag",
          estadoBot: "escalado",
        };
      },
    });
    const pending = pipeline.process({
      canal: "whatsapp",
      externalThreadId: "wa:+52901",
      externalMessageId: "en-vuelo",
      texto: "tienen capilla",
      recibidoEn: new Date().toISOString(),
    });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(entro).toBe(true);
    store.setEstadoBot(conv.id, "humano");
    release();
    const result = await pending;
    expect(result).toMatchObject({
      ruta: "silencio",
      silencio: true,
      estadoBot: "humano",
      textoRespuesta: "",
    });
    expect(outbound.drain()).toEqual([]);
    expect(store.getById(conv.id)?.estadoBot).toBe("humano");
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
