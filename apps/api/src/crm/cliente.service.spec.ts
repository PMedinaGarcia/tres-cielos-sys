import { Test } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ClienteService } from "./cliente.service";
import { PrismaService } from "../prisma/prisma.service";
import type { PanelUser } from "../auth/auth.types";

const asesor: PanelUser = {
  userId: "asesor-1",
  email: "ana@trescielos.local",
  name: "Ana",
  role: "asesor",
  sedeIds: ["sede-1"],
  orgId: "org-1",
  flags: { activo: true, disponible: true },
};

const now = new Date("2026-08-26T12:00:00.000Z");

function clienteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cli-1",
    nombre: "María",
    telefono: "+52155",
    correo: null,
    nombrePerfilCanal: "Maria",
    estadoAtencion: "bot_activo",
    asesorAsignadoId: null,
    canalOrigen: "whatsapp",
    fuenteAlta: "bot",
    origenJson: null,
    sedeInteresId: null,
    idioma: "es",
    zonaHoraria: null,
    optOutMensajeria: false,
    fusionadoEnClienteId: null,
    primerContactoEn: now,
    ultimoContactoEn: now,
    creadoEn: now,
    actualizadoEn: now,
    identificadores: [],
    tags: [],
    notas: [],
    oportunidades: [],
    conversaciones: [],
    ...overrides,
  };
}

describe("ClienteService", () => {
  const prisma = {
    cliente: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    interaccion: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    notaCliente: { create: jest.fn() },
    tag: { upsert: jest.fn() },
    clienteTag: { deleteMany: jest.fn(), createMany: jest.fn() },
    identificadorCliente: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    mensaje: { findMany: jest.fn() },
  };
  let service: ClienteService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ClienteService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ClienteService);
  });

  it("lista con paginación", async () => {
    prisma.cliente.findMany.mockResolvedValue([clienteRow()]);
    prisma.cliente.count.mockResolvedValue(1);
    const res = await service.list(asesor, { page: 1, pageSize: 20 });
    expect(res.meta.total).toBe(1);
    expect(res.data[0]?.nombre).toBe("María");
    expect(res.data[0]?.estadoAtencion).toBe("bot_activo");
  });

  it("404 si el asesor no ve al cliente ajeno", async () => {
    prisma.cliente.findFirst.mockResolvedValue(null);
    await expect(service.getById(asesor, "cli-x")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("PATCH emite edicion_ficha", async () => {
    prisma.cliente.findFirst.mockResolvedValue(clienteRow());
    prisma.cliente.update.mockResolvedValue(
      clienteRow({ nombre: "María López" }),
    );
    prisma.interaccion.create.mockResolvedValue({});
    const res = await service.update(asesor, "cli-1", { nombre: "María López" });
    expect(res.data.nombre).toBe("María López");
    expect(prisma.interaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: "edicion_ficha" }),
      }),
    );
  });

  it("nota + interacción", async () => {
    prisma.cliente.findFirst.mockResolvedValue(clienteRow());
    prisma.notaCliente.create.mockResolvedValue({
      id: "nota-1",
      autorId: asesor.userId,
      cuerpo: "Llamar jueves",
      creadoEn: now,
    });
    const res = await service.addNota(asesor, "cli-1", {
      cuerpo: "Llamar jueves",
    });
    expect(res.data.cuerpo).toBe("Llamar jueves");
    expect(prisma.interaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: "nota" }),
      }),
    );
  });

  it("asesor no edita cliente de otro", async () => {
    prisma.cliente.findFirst.mockResolvedValue(
      clienteRow({ asesorAsignadoId: "otro" }),
    );
    await expect(
      service.update(asesor, "cli-1", { nombre: "X" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("q busca también por identificador / huella", async () => {
    prisma.cliente.findMany.mockResolvedValue([clienteRow()]);
    prisma.cliente.count.mockResolvedValue(1);
    await service.list(asesor, { q: "+5215512345678", page: 1, pageSize: 20 });
    const arg = prisma.cliente.findMany.mock.calls[0][0] as {
      where: { AND: unknown[] };
    };
    const serialized = JSON.stringify(arg.where);
    expect(serialized).toContain("identificadores");
    expect(serialized).toContain("5512345678");
  });

  it("cola visitas_sin_agendar filtra por visita solicitada", async () => {
    prisma.cliente.findMany.mockResolvedValue([clienteRow()]);
    prisma.cliente.count.mockResolvedValue(1);
    await service.list(asesor, {
      cola: "visitas_sin_agendar",
      page: 1,
      pageSize: 20,
    });
    const arg = prisma.cliente.findMany.mock.calls[0][0] as {
      where: unknown;
    };
    expect(JSON.stringify(arg.where)).toContain("solicitada");
  });

  it("cola listos_sin_propuesta filtra etapaCotizacion", async () => {
    prisma.cliente.findMany.mockResolvedValue([clienteRow()]);
    prisma.cliente.count.mockResolvedValue(1);
    await service.list(asesor, {
      cola: "listos_sin_propuesta",
      page: 1,
      pageSize: 20,
    });
    const arg = prisma.cliente.findMany.mock.calls[0][0] as {
      where: unknown;
    };
    expect(JSON.stringify(arg.where)).toContain("listo_para_cotizar");
  });

  it("cola atencion_general filtra ruta comercial", async () => {
    prisma.cliente.findMany.mockResolvedValue([clienteRow()]);
    prisma.cliente.count.mockResolvedValue(1);
    await service.list(asesor, {
      cola: "atencion_general",
      page: 1,
      pageSize: 20,
    });
    const arg = prisma.cliente.findMany.mock.calls[0][0] as {
      where: unknown;
    };
    expect(JSON.stringify(arg.where)).toContain("atencion_general");
  });

  it("historial unificado no recorta el texto del mensaje", async () => {
    const long = "A".repeat(400);
    prisma.cliente.findFirst.mockResolvedValue(clienteRow());
    prisma.mensaje.findMany.mockResolvedValue([
      {
        id: "msg-1",
        conversacionId: "conv-1",
        direccion: "entrante",
        autor: "prospecto",
        canal: "whatsapp",
        contenido: long,
        plantillaUtilityId: null,
        creadoEn: now,
        adjuntos: [],
        conversacion: { clienteId: "cli-1", canal: "whatsapp" },
      },
    ]);
    prisma.interaccion.findMany.mockResolvedValue([
      {
        id: "int-1",
        clienteId: "cli-1",
        oportunidadId: "opp-1",
        conversacionId: "conv-1",
        mensajeId: null,
        tipo: "recontacto",
        actor: "sistema",
        canal: "whatsapp",
        resumen: "Recontacto",
        payload: { otroClienteId: "cli-2" },
        creadoEn: now,
      },
    ]);
    const res = await service.historial(asesor, "cli-1", { page: 1, pageSize: 50 });
    const msg = res.data.find((i) => i.kind === "mensaje");
    expect(msg?.contenido).toBe(long);
    expect(msg?.contenido.length).toBe(400);
    expect(res.data.some((i) => i.tipo === "recontacto")).toBe(true);
  });

  it("historial incluye hilo de expediente vinculado sin recortar", async () => {
    const identidad = {
      vinculosFor: jest.fn(async () => [
        {
          clienteId: "cli-2",
          relacion: "posible_duplicado" as const,
          nombre: "María 2",
          telefono: "+525512345678",
          primerContactoEn: now.toISOString(),
        },
      ]),
    };
    const svc = new ClienteService(prisma as never, identidad as never);
    prisma.cliente.findFirst.mockResolvedValue(clienteRow());
    prisma.mensaje.findMany.mockResolvedValue([
      {
        id: "msg-old",
        conversacionId: "conv-old",
        direccion: "entrante",
        autor: "prospecto",
        canal: "whatsapp",
        contenido: "Hola, cotización del año pasado " + "x".repeat(200),
        plantillaUtilityId: null,
        creadoEn: now,
        adjuntos: [],
        conversacion: { clienteId: "cli-2", canal: "whatsapp" },
      },
    ]);
    prisma.interaccion.findMany.mockResolvedValue([]);
    const res = await svc.historial(asesor, "cli-1", { page: 1, pageSize: 50 });
    expect(identidad.vinculosFor).toHaveBeenCalledWith("cli-1");
    expect(res.data[0]?.vinculo).toBe("posible_duplicado");
    expect(res.data[0]?.contenido.length).toBeGreaterThan(180);
  });

  it("elimina el cliente en alcance", async () => {
    prisma.cliente.findFirst.mockResolvedValue(clienteRow());
    prisma.cliente.delete.mockResolvedValue(clienteRow());
    await service.remove(asesor, "cli-1");
    expect(prisma.cliente.delete).toHaveBeenCalledWith({
      where: { id: "cli-1" },
    });
  });

  it("404 si el asesor no ve al cliente al eliminar", async () => {
    prisma.cliente.findFirst.mockResolvedValue(null);
    await expect(service.remove(asesor, "cli-x")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.cliente.delete).not.toHaveBeenCalled();
  });

  it("asesor no elimina cliente de otro", async () => {
    prisma.cliente.findFirst.mockResolvedValue(
      clienteRow({ asesorAsignadoId: "otro" }),
    );
    await expect(service.remove(asesor, "cli-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.cliente.delete).not.toHaveBeenCalled();
  });
});
