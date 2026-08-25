import { ExpedientePersistService } from "./expediente-persist.service";
import { resolveTelefonoCanal } from "../conversation/telefono";
import type { ConversacionState } from "../conversation/types";

function baseConv(
  overrides?: Partial<ConversacionState>,
): ConversacionState {
  return {
    id: "conv-1",
    canal: "whatsapp",
    externalThreadId: "wa:+5215512345678",
    estadoBot: "activo",
    pasoGuion: "aforo",
    camposCapturados: {
      telefono: "+5215512345678",
      nombre: "Patricio Medina",
      tipoEvento: "corporativo",
      fechaTentativa: {
        tipo: "dia",
        fecha: "2026-12-22",
        flexible: false,
      },
      aforo: 120,
    },
    paqueteTentativoId: null,
    ultimaRuta: "guion",
    motivoHandoff: null,
    escaladoEn: null,
    oportunidadId: "opp-1",
    brief: { version: 1 },
    calificado: false,
    listoParaCotizar: false,
    mensajes: [],
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
    ...overrides,
  };
}

describe("resolveTelefonoCanal", () => {
  it("toma waId o hilo wa:+52", () => {
    expect(
      resolveTelefonoCanal({ waId: "whatsapp:+5215512345678" }),
    ).toBe("+5215512345678");
    expect(
      resolveTelefonoCanal({ externalThreadId: "wa:+5215599988877" }),
    ).toBe("+5215599988877");
    expect(resolveTelefonoCanal({ externalThreadId: "sandbox-web" })).toBeNull();
  });
});

describe("ExpedientePersistService", () => {
  const prevDb = process.env.DATABASE_URL;

  afterEach(() => {
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
  });

  it("no escribe si falta DATABASE_URL", async () => {
    delete process.env.DATABASE_URL;
    const prisma = {
      conversacion: { findUnique: jest.fn() },
    };
    const svc = new ExpedientePersistService(prisma as never);
    await svc.persistAfterTurn(baseConv());
    expect(prisma.conversacion.findUnique).not.toHaveBeenCalled();
  });

  it("upsert Lead/Oportunidad/Conversacion con numero, nombre, fecha, evento y personas", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const prisma = {
      conversacion: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => ({ id: "conv-1" })),
        update: jest.fn(),
      },
      lead: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => ({ id: "lead-1" })),
        update: jest.fn(),
      },
      oportunidad: {
        create: jest.fn(async () => ({ id: "opp-1" })),
        update: jest.fn(),
      },
    };
    const svc = new ExpedientePersistService(prisma as never);
    await svc.persistAfterTurn(baseConv());

    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nombre: "Patricio Medina",
        telefono: "+5215512345678",
        waId: "+5215512345678",
      }),
    });
    expect(prisma.oportunidad.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipoEvento: "corporativo",
        aforo: 120,
        fechaTentativa: new Date("2026-12-22T12:00:00.000Z"),
      }),
    });
    expect(prisma.conversacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        camposCapturados: expect.objectContaining({
          telefono: "+5215512345678",
          nombre: "Patricio Medina",
          tipoEvento: "corporativo",
          aforo: 120,
          fechaTentativa: expect.objectContaining({ fecha: "2026-12-22" }),
        }),
      }),
    });
  });
});
