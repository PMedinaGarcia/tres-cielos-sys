import { AssignmentEngine } from "./assignment-engine.service";

const SEDE = "sede-tequesquitengo";

function oportunidad(over: Record<string, unknown> = {}) {
  return {
    id: "opp-1",
    clienteId: "cli-1",
    asesorAsignadoId: null as string | null,
    tipoEvento: "boda",
    primerContactoHumanoEn: null,
    cliente: {
      id: "cli-1",
      sedeInteresId: SEDE,
      asesorAsignadoId: null as string | null,
    },
    conversaciones: [{ id: "conv-1", cola: "comercial", slaVenceEn: null }],
    ...over,
  };
}

describe("AssignmentEngine", () => {
  const prevDb = process.env.DATABASE_URL;

  afterEach(() => {
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
  });

  it("sin base no asigna", async () => {
    delete process.env.DATABASE_URL;
    const engine = new AssignmentEngine();
    expect(await engine.asignar({ oportunidadId: "opp-1", disparador: "calificado" })).toBeNull();
  });

  it("conserva al dueño activo en un handoff", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const opp = oportunidad({
      asesorAsignadoId: "ana",
      cliente: { id: "cli-1", sedeInteresId: SEDE, asesorAsignadoId: "ana" },
    });
    const tx = {
      oportunidad: { findUnique: jest.fn(async () => opp) },
      sede: {
        findUnique: jest.fn(async () => ({
          id: SEDE,
          zonaHoraria: "America/Mexico_City",
        })),
      },
      $executeRaw: jest.fn(async () => 1),
      asignacion: {
        findFirst: jest.fn(async () => ({ usuarioDestinoId: "ana" })),
        create: jest.fn(),
      },
      usuario: {
        findUnique: jest.fn(async () => ({ id: "ana", activo: true })),
      },
    };
    const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
    const engine = new AssignmentEngine(prisma as never);
    const res = await engine.asignar({ oportunidadId: "opp-1", disparador: "handoff" });
    expect(res?.estado).toBe("conservado");
    expect(res?.asesorId).toBe("ana");
    expect(tx.asignacion.create).not.toHaveBeenCalled();
  });

  it("sin asesores elegibles deja el lead en la cola", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const tx = {
      oportunidad: { findUnique: jest.fn(async () => oportunidad()) },
      sede: {
        findUnique: jest.fn(async () => ({
          id: SEDE,
          zonaHoraria: "America/Mexico_City",
        })),
      },
      $executeRaw: jest.fn(async () => 1),
      asignacion: { findFirst: jest.fn(async () => null) },
      politicaAsignacion: {
        findUnique: jest.fn(async () => ({
          sedeId: SEDE,
          topeSinContactar: 8,
          topeAbiertas: 40,
          topeNuevosDia: null,
          slaMinutos: 30,
          slaReasignar: false,
          preferirEspecialidad: false,
        })),
      },
      usuarioSede: { findMany: jest.fn(async () => []) },
      colaAsignacion: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => ({ id: "cola-1" })),
      },
    };
    const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
    const engine = new AssignmentEngine(prisma as never);
    const res = await engine.asignar({
      oportunidadId: "opp-1",
      disparador: "calificado",
      motivo: "calificado",
    });
    expect(res?.estado).toBe("en_cola");
    expect(res?.motivoCola).toBe("sin_disponibles");
    expect(tx.colaAsignacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          motivo: "sin_disponibles",
          estado: "esperando",
        }),
      }),
    );
  });

  it("reparte al de menor carga y deja el candado del hilo", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const tx = {
      oportunidad: {
        findUnique: jest.fn(async () => oportunidad()),
        update: jest.fn(),
        groupBy: jest.fn(async () => [
          { asesorAsignadoId: "ana", _count: { _all: 2 } },
          { asesorAsignadoId: "luis", _count: { _all: 0 } },
        ]),
      },
      sede: {
        findUnique: jest.fn(async () => ({
          id: SEDE,
          zonaHoraria: "America/Mexico_City",
        })),
      },
      $executeRaw: jest.fn(async () => 1),
      asignacion: {
        findFirst: jest.fn(async () => null),
        updateMany: jest.fn(),
        create: jest.fn(),
        groupBy: jest.fn(async () => [
          { usuarioDestinoId: "ana", _count: { _all: 2 } },
          { usuarioDestinoId: "luis", _count: { _all: 0 } },
        ]),
      },
      politicaAsignacion: {
        findUnique: jest.fn(async () => ({
          sedeId: SEDE,
          topeSinContactar: 8,
          topeAbiertas: 40,
          topeNuevosDia: null,
          slaMinutos: 30,
          slaReasignar: false,
          preferirEspecialidad: false,
        })),
      },
      usuarioSede: {
        findMany: jest.fn(async () => [
          miembro("ana", 2),
          miembro("luis", 0),
        ]),
        updateMany: jest.fn(),
      },
      cliente: { update: jest.fn() },
      conversacion: { updateMany: jest.fn(), update: jest.fn() },
      colaAsignacion: { updateMany: jest.fn() },
      eventoOperativo: { create: jest.fn() },
      interaccion: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
    const engine = new AssignmentEngine(prisma as never);
    const res = await engine.asignar({
      oportunidadId: "opp-1",
      disparador: "calificado",
      motivo: "calificado",
    });
    expect(res?.estado).toBe("asignado");
    expect(res?.asesorId).toBe("luis");
    expect(tx.conversacion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { asesorLockId: "luis" } }),
    );
    expect(tx.asignacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          usuarioDestinoId: "luis",
          regla: "menor_carga_sede",
          vigente: true,
        }),
      }),
    );
  });
});

function miembro(id: string, sinContactar: number) {
  return {
    usuarioId: id,
    peso: 1,
    ultimoAsignadoEn: null,
    topeSinContactarOverride: null,
    topeAbiertasOverride: null,
    usuario: { especialidades: [], horarios: [] },
    sinContactar,
  };
}
