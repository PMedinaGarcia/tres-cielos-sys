import { Test } from "@nestjs/testing";
import { OportunidadService } from "./oportunidad.service";
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

function oppRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "opp-1",
    clienteId: "cli-1",
    tipoEvento: "boda",
    fechaTentativa: now,
    aforo: 150,
    sede: "Tres Cielos",
    calificacion: "calificado",
    listoParaCotizar: true,
    paqueteTentativoId: "pkg-1",
    etapa: "calificado",
    motivoPerdido: null,
    intencionVisita: true,
    visitaEstado: "solicitada",
    visitaAgendadaEn: null,
    visitaNotas: null,
    propuestaEnviadaEn: null,
    etapaCotizacion: "listo_para_cotizar",
    asesorAsignadoId: asesor.userId,
    briefJson: null,
    cliente: {
      id: "cli-1",
      asesorAsignadoId: asesor.userId,
      ultimoContactoEn: now,
      estadoAtencion: "escalado",
    },
    conversaciones: [],
    ...overrides,
  };
}

describe("OportunidadService", () => {
  const prisma = {
    oportunidad: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    interaccion: { create: jest.fn() },
  };
  let service: OportunidadService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        OportunidadService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(OportunidadService);
  });

  it("marcar agendada sale de visita solicitada", async () => {
    prisma.oportunidad.findFirst.mockResolvedValue(oppRow());
    prisma.oportunidad.update.mockImplementation(
      async (args: { data: Record<string, unknown> }) =>
        oppRow({
          visitaEstado: args.data.visitaEstado,
          visitaAgendadaEn: args.data.visitaAgendadaEn,
          etapaCotizacion: args.data.etapaCotizacion,
        }),
    );
    const cuando = "2026-09-01T16:00:00.000Z";
    const res = await service.update(asesor, "opp-1", {
      visitaEstado: "agendada",
      visitaAgendadaEn: cuando,
    });
    expect(prisma.oportunidad.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visitaEstado: "agendada",
          intencionVisita: true,
        }),
      }),
    );
    expect(res.data.visitaEstado).toBe("agendada");
    expect(prisma.interaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: "cambio_visita" }),
      }),
    );
  });

  it("marcar propuesta avanza etapa a propuesta", async () => {
    prisma.oportunidad.findFirst.mockResolvedValue(oppRow());
    prisma.oportunidad.update.mockImplementation(
      async (args: { data: Record<string, unknown> }) =>
        oppRow({
          etapa: args.data.etapa,
          propuestaEnviadaEn: args.data.propuestaEnviadaEn,
          etapaCotizacion: args.data.etapaCotizacion,
        }),
    );
    const res = await service.update(asesor, "opp-1", {
      marcarPropuestaEnviada: true,
    });
    expect(prisma.oportunidad.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ etapa: "propuesta" }),
      }),
    );
    expect(res.data.etapaCotizacion).toBe("propuesta_enviada");
    expect(prisma.interaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: "propuesta_enviada" }),
      }),
    );
  });
});
