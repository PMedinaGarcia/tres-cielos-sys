import { IdentidadService } from "./identidad.service";
import { identifiersFromThread } from "./cliente-identity";

function cliente(id: string, primer: string) {
  return {
    id,
    primerContactoEn: new Date(primer),
    creadoEn: new Date(primer),
    nombre: id,
    telefono: "+525512345678",
  };
}

describe("IdentidadService", () => {
  it("elige el cliente más antiguo como canónico", async () => {
    const rows = [
      cliente("nuevo", "2026-08-01T00:00:00.000Z"),
      cliente("viejo", "2025-01-10T00:00:00.000Z"),
    ];
    const prisma = {
      cliente: {
        findMany: jest.fn(async () =>
          [...rows].sort(
            (a, b) =>
              a.primerContactoEn.getTime() - b.primerContactoEn.getTime(),
          ),
        ),
      },
    };
    const svc = new IdentidadService(prisma as never);
    const canonical = await svc.pickCanonical(["nuevo", "viejo"]);
    expect(canonical?.id).toBe("viejo");
    expect(prisma.cliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { primerContactoEn: "asc" },
          { creadoEn: "asc" },
          { id: "asc" },
        ],
      }),
    );
  });

  it("findMatchingClienteIds cruza huella telefono/wa_id", async () => {
    const prisma = {
      identificadorCliente: {
        findMany: jest.fn(async () => [{ clienteId: "cli-old" }]),
        findUnique: jest.fn(async () => null),
      },
      cliente: {
        findMany: jest.fn(async () => [{ id: "cli-old" }]),
      },
    };
    const svc = new IdentidadService(prisma as never);
    const identifiers = identifiersFromThread({
      canal: "whatsapp",
      externalThreadId: "wa:+5215512345678",
    });
    const ids = await svc.findMatchingClienteIds(identifiers);
    expect(ids).toContain("cli-old");
    expect(prisma.identificadorCliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipo: { in: ["telefono", "wa_id"] },
          valorNormalizado: { in: expect.arrayContaining(["5512345678"]) },
        }),
      }),
    );
  });
});
