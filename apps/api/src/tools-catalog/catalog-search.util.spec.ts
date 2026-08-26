import { aforoDistance, pickCercanos } from "./catalog-search.util";

describe("catalog-search.util", () => {
  it("mide distancia de aforo al rango", () => {
    expect(aforoDistance(20, 80, 150)).toBe(60);
    expect(aforoDistance(120, 80, 150)).toBe(0);
    expect(aforoDistance(250, 80, 150)).toBe(100);
  });

  it("elige el paquete más cercano por aforo", () => {
    const picked = pickCercanos(
      [
        { nombre: "Paquete Estándar", aforoMin: 100, aforoMax: 300 },
        { nombre: "Upgrade Premium", aforoMin: 100, aforoMax: 300 },
      ],
      20,
      1,
    );
    expect(picked[0]?.nombre).toBe("Paquete Estándar");
  });
});
