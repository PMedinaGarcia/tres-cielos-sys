import { AuditService } from "./audit.service";

describe("AuditService", () => {
  const prevDb = process.env.DATABASE_URL;

  afterEach(() => {
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
  });

  it("sin DATABASE_URL solo guarda en memoria", async () => {
    delete process.env.DATABASE_URL;
    const prisma = {
      conversacion: { findUnique: jest.fn() },
      eventoOperativo: { create: jest.fn() },
      interaccion: { create: jest.fn() },
    };
    const svc = new AuditService(prisma as never);
    const evt = await svc.record({
      tipo: "bot_handoff",
      actor: "bot",
      conversacionId: "conv-1",
      payload: { motivoHandoff: "solicitud_usuario" },
    });
    expect(evt.tipo).toBe("bot_handoff");
    expect(prisma.eventoOperativo.create).not.toHaveBeenCalled();
    expect(svc.listByConversacion("conv-1")).toHaveLength(1);
  });

  it("con DATABASE_URL persiste EventoOperativo e Interaccion", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const prisma = {
      conversacion: {
        findUnique: jest.fn(async () => ({
          clienteId: "cli-1",
          oportunidadId: "opp-1",
        })),
      },
      oportunidad: { findUnique: jest.fn() },
      mensaje: { findUnique: jest.fn(async () => null) },
      eventoOperativo: { create: jest.fn(async () => ({})) },
      interaccion: { create: jest.fn(async () => ({})) },
    };
    const svc = new AuditService(prisma as never);
    await svc.record({
      tipo: "bot_handoff",
      actor: "bot",
      conversacionId: "conv-1",
      payload: { motivoHandoff: "solicitud_usuario" },
    });
    expect(prisma.eventoOperativo.create).toHaveBeenCalled();
    expect(prisma.interaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clienteId: "cli-1",
          tipo: "handoff",
        }),
      }),
    );
  });
});
