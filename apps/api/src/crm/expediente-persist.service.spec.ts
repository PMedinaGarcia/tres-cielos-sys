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
    mensajes: [
      {
        id: "msg-in",
        direccion: "entrante",
        autor: "prospecto",
        contenido: "Hola",
        timestamp: "2026-08-26T12:00:00.000Z",
        externalMessageId: "SM-in-1",
        consumioCupo: false,
      },
      {
        id: "msg-out",
        direccion: "saliente",
        autor: "bot",
        contenido: "¿Cuántas personas?",
        timestamp: "2026-08-26T12:00:01.000Z",
        consumioCupo: true,
        ruta: "guion",
      },
    ],
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
    ...overrides,
  };
}

function mockPrisma() {
  return {
    conversacion: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async (args: { data: { id: string } }) => ({
        id: args.data.id,
      })),
      update: jest.fn(),
      count: jest.fn(async () => 0),
    },
    identificadorCliente: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      create: jest.fn(async () => ({ id: "ident-1" })),
    },
    cliente: {
      create: jest.fn(async () => ({
        id: "cli-1",
        estadoAtencion: "nuevo",
        asesorAsignadoId: null,
      })),
      update: jest.fn(async () => ({
        id: "cli-1",
        estadoAtencion: "bot_activo",
        asesorAsignadoId: null,
      })),
      findUnique: jest.fn(async () => ({
        id: "cli-1",
        estadoAtencion: "nuevo",
        asesorAsignadoId: null,
      })),
      findMany: jest.fn(async () => []),
    },
    oportunidad: {
      create: jest.fn(async () => ({ id: "opp-1" })),
      update: jest.fn(),
    },
    mensaje: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async (args: { data: { id: string } }) => ({
        id: args.data.id,
      })),
    },
    interaccion: {
      create: jest.fn(),
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
    adjuntoMensaje: { create: jest.fn() },
    sede: { findUnique: jest.fn(async () => null) },
    paquete: { findUnique: jest.fn(async () => null) },
    eventoOperativo: { create: jest.fn() },
    asignacion: {
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    usuario: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
  };
}

describe("resolveTelefonoCanal", () => {
  it("toma waId o hilo wa:+52 y unifica a +52 + 10 dígitos", () => {
    expect(
      resolveTelefonoCanal({ waId: "whatsapp:+5215512345678" }),
    ).toBe("+525512345678");
    expect(
      resolveTelefonoCanal({ externalThreadId: "wa:+5215599988877" }),
    ).toBe("+525599988877");
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
    const prisma = mockPrisma();
    const svc = new ExpedientePersistService(prisma as never);
    await svc.persistAfterTurn(baseConv());
    expect(prisma.conversacion.findUnique).not.toHaveBeenCalled();
  });

  it("upsert Cliente/Oportunidad/Conversacion y persiste mensajes", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const prisma = mockPrisma();
    const svc = new ExpedientePersistService(prisma as never);
    await svc.persistAfterTurn(baseConv());

    expect(prisma.cliente.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nombre: "Patricio Medina",
        telefono: "+525512345678",
        canalOrigen: "whatsapp",
        fuenteAlta: "bot",
      }),
    });
    expect(prisma.identificadorCliente.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: "wa_id",
        valorNormalizado: "5512345678",
      }),
    });
    expect(prisma.oportunidad.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clienteId: "cli-1",
        tipoEvento: "corporativo",
        aforo: 120,
        fechaTentativa: new Date("2026-12-22T12:00:00.000Z"),
      }),
    });
    expect(prisma.conversacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clienteId: "cli-1",
        camposCapturados: expect.objectContaining({
          telefono: "+5215512345678",
          nombre: "Patricio Medina",
          tipoEvento: "corporativo",
          aforo: 120,
        }),
      }),
    });
    expect(prisma.mensaje.create).toHaveBeenCalledTimes(2);
    expect(prisma.interaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: "mensaje" }),
      }),
    );
    expect(prisma.cliente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estadoAtencion: "bot_activo" }),
      }),
    );
  });

  it("no persiste una frase de intención como Cliente.nombre", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const prisma = mockPrisma();
    const svc = new ExpedientePersistService(prisma as never);
    await svc.persistAfterTurn(
      baseConv({
        camposCapturados: {
          ...baseConv().camposCapturados,
          nombre: "Quiero reservar",
        },
      }),
    );
    expect(prisma.cliente.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nombre: null,
        nombrePerfilCanal: null,
      }),
    });
    expect(prisma.conversacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        camposCapturados: expect.objectContaining({ nombre: null }),
      }),
    });
  });

  it("escalado actualiza estadoAtencion y no asigna si no hay asesor real", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const prisma = mockPrisma();
    const assignment = {
      pickAsesorPersistible: jest.fn(async () => null),
    };
    const svc = new ExpedientePersistService(
      prisma as never,
      assignment as never,
    );
    await svc.persistAfterTurn(
      baseConv({ estadoBot: "escalado", motivoHandoff: "solicitud_usuario" }),
    );
    expect(prisma.cliente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estadoAtencion: "escalado" }),
      }),
    );
    expect(assignment.pickAsesorPersistible).toHaveBeenCalled();
    expect(prisma.asignacion.create).not.toHaveBeenCalled();
  });

  it("emite intencion_cotizar cuando el perfil queda listo y pidió cotizar", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const prisma = mockPrisma();
    const svc = new ExpedientePersistService(prisma as never);
    await svc.persistAfterTurn(
      baseConv({
        pedidoCotizacion: true,
        pedidoCotizacionFuente: "texto_monetario",
        camposCapturados: {
          ...baseConv().camposCapturados,
          sedeId: "sede-tequesquitengo",
          sedeNombre: "Tres Cielos Tequesquitengo",
          intencionCotizar: true,
        },
      }),
    );
    expect(prisma.interaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: "intencion_cotizar",
          resumen: "Lead pidió cotizar",
          payload: expect.objectContaining({ pedido: true }),
        }),
      }),
    );
  });

  it("emite intencion_cotizar con pedido false cuando rechaza", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const prisma = mockPrisma();
    const svc = new ExpedientePersistService(prisma as never);
    await svc.persistAfterTurn(
      baseConv({
        pedidoCotizacion: false,
        pedidoCotizacionFuente: "rechazo",
        camposCapturados: {
          ...baseConv().camposCapturados,
          sedeId: "sede-tequesquitengo",
          sedeNombre: "Tres Cielos Tequesquitengo",
          intencionCotizar: false,
        },
      }),
    );
    expect(prisma.interaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: "intencion_cotizar",
          resumen: "Lead no pidió cotizar",
          payload: expect.objectContaining({ pedido: false }),
        }),
      }),
    );
  });

  it("no emite intencion_cotizar solo porque listoParaCotizar pasa a true", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const prisma = mockPrisma();
    const svc = new ExpedientePersistService(prisma as never);
    await svc.persistAfterTurn(baseConv({ listoParaCotizar: true }));
    const tipos = (
      prisma.interaccion.create as jest.Mock
    ).mock.calls.map(
      (c: [{ data: { tipo: string } }]) => c[0].data.tipo,
    );
    expect(tipos).not.toContain("intencion_cotizar");
  });

  it("quiero visitar deja visitaEstado=solicitada", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const prisma = mockPrisma();
    const svc = new ExpedientePersistService(prisma as never);
    const conv = baseConv({
      pasoGuion: "faq_libre",
      camposCapturados: {
        ...baseConv().camposCapturados,
        intencionVisita: true,
      },
    });
    await svc.persistAfterTurn(conv);
    expect(prisma.oportunidad.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        intencionVisita: true,
        visitaEstado: "solicitada",
      }),
    });
    expect(prisma.interaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: "cambio_visita" }),
      }),
    );
  });

  it("persiste consulta_catalogo como EventoOperativo cuando el brief trae snapshot nuevo", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const prisma = mockPrisma();
    const svc = new ExpedientePersistService(prisma as never);
    await svc.persistAfterTurn(
      baseConv({
        brief: {
          version: 2,
          consultaCatalogoAlMomento: {
            id: "reg-cat-1",
            tool: "buscar_paquetes",
            input: { fecha: "2027-01-22", aforo: 150 },
            filasSku: ["EVT-J1-TC"],
            ok: true,
            creadoEn: "2026-08-30T19:00:00.000Z",
          },
        },
      }),
    );
    expect(prisma.eventoOperativo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: "consulta_catalogo",
        actor: "bot",
        payload: expect.objectContaining({ id: "reg-cat-1" }),
      }),
    });
  });
});
