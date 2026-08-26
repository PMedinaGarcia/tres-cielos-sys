import { AssignmentService } from "./assignment.service";

describe("AssignmentService.pickAsesorPersistible", () => {
  const prevDb = process.env.DATABASE_URL;

  afterEach(() => {
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
  });

  it("sin DB no asigna (bandeja sin dueño)", async () => {
    delete process.env.DATABASE_URL;
    const svc = new AssignmentService();
    expect(await svc.pickAsesorPersistible({ sedeId: "sede-1" })).toBeNull();
  });

  it("round-robin sobre asesores reales", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const prisma = {
      usuario: {
        findMany: jest.fn(async () => [{ id: "u-ana" }, { id: "u-luis" }]),
      },
    };
    const svc = new AssignmentService(prisma as never);
    const a = await svc.pickAsesorPersistible({ sedeId: "sede-1" });
    const b = await svc.pickAsesorPersistible({ sedeId: "sede-1" });
    expect(a?.asesorId).toBe("u-ana");
    expect(b?.asesorId).toBe("u-luis");
    expect(a?.regla).toBe("sede_disponibilidad_round_robin");
  });

  it("sin asesores disponibles → null", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    const prisma = {
      usuario: { findMany: jest.fn(async () => []) },
    };
    const svc = new AssignmentService(prisma as never);
    expect(await svc.pickAsesorPersistible({})).toBeNull();
  });
});
