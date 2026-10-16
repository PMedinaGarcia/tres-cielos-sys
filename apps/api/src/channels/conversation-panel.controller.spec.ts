import { ConversationPanelController } from "./conversation-panel.controller";
import type { BandejaService } from "./bandeja.service";
import type { ConversationStateStore } from "./conversation-state.store";
import type { AuditService } from "../audit/audit.service";
import type { ExpedientePersistService } from "../crm/expediente-persist.service";
import type { ConversationStoreService } from "../conversation/stubs/conversation-store.service";
import type { PrismaService } from "../prisma/prisma.service";
import { NurtureWorkerService } from "../conversation/nurture/nurture.worker";
import type { PanelUser } from "../auth/auth.types";

const user: PanelUser = {
  userId: "asesor-1",
  email: "a@t.local",
  name: "Ana",
  role: "asesor",
  sedeIds: [],
  orgId: "org-1",
  flags: { activo: true, disponible: true },
};

function buildPanel(opts?: {
  lock?: string | null;
  orch?: Record<string, unknown> | null;
}) {
  const conversations = {
    getById: jest.fn(() => ({ id: "c1", estadoBot: "escalado" })),
    setEstadoBot: jest.fn(),
  } as unknown as ConversationStateStore;
  const audit = {
    record: jest.fn(async () => ({ id: "ev-1" })),
  } as unknown as AuditService;
  const expediente = {
    findLock: jest.fn(async () => opts?.lock ?? null),
    persistTomaControl: jest.fn(async () => undefined),
    persistDevolverABot: jest.fn(async () => undefined),
  } as unknown as ExpedientePersistService;
  const orchStore = {
    findById: jest.fn(async () =>
      opts?.orch === undefined
        ? {
            id: "c1",
            estadoBot: "escalado",
            camposCapturados: { nombre: "Ana", fechaEstado: "ventana" },
            pasoGuion: "aforo_inversion",
          }
        : opts.orch,
    ),
    update: jest.fn(async () => undefined),
  } as unknown as ConversationStoreService;
  const prisma = {
    conversacion: { findUnique: jest.fn(async () => ({ id: "c1" })) },
  } as unknown as PrismaService;
  const nurture = new NurtureWorkerService();
  const bandeja = {
    tomarControl: jest.fn(async () => ({
      id: "c1",
      estadoBot: "humano" as const,
      eventoOperativoId: "ev-1",
    })),
  } as unknown as BandejaService;
  const ctrl = new ConversationPanelController(
    conversations,
    audit,
    expediente,
    orchStore,
    prisma,
    bandeja,
    nurture,
  );
  return { ctrl, expediente, orchStore, nurture, bandeja };
}

describe("ConversationPanelController v3", () => {
  it("tomar-control delega en la bandeja", async () => {
    const { ctrl, bandeja } = buildPanel();
    const res = await ctrl.tomarControl("c1", { motivo: "manual" }, user);
    expect(res.estadoBot).toBe("humano");
    expect(bandeja.tomarControl).toHaveBeenCalledWith(
      "c1",
      { motivo: "manual" },
      user,
    );
  });

  it("devolver-a-bot 200 con asesor_libera agenda nutrición", async () => {
    const { ctrl, nurture, orchStore } = buildPanel();
    const res = await ctrl.devolverABot("c1", { motivo: "asesor_libera" });
    expect(res.estadoBot).toBe("activo");
    expect(nurture.list("c1")).toHaveLength(2);
    expect(orchStore.update).toHaveBeenCalledWith(
      "c1",
      expect.not.objectContaining({ pasoGuion: "faq_libre" }),
    );
  });

  it("devolver-a-bot sin motivo válido sigue 409", async () => {
    const { ctrl } = buildPanel();
    await expect(ctrl.devolverABot("c1", { motivo: "otro" })).rejects.toMatchObject({
      status: 409,
    });
  });
});
