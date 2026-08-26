import {
  AFORO_TRAMOS_BODA,
  FECHA_EVENTO_DEFAULT_CATALOGO,
  canonicalizeSku,
  sedeToCatalogSlug,
} from "@tres-cielos/shared";
import {
  fechaConsultaDate,
  matchPrecioPorAforo,
  type PrecioRowLike,
} from "./catalog-price.util";

describe("catalog-price.util", () => {
  const tc: PrecioRowLike[] = [
    { monto: 2980, moneda: "MXN", unidad: "persona", rangoMin: 100, rangoMax: 100 },
    { monto: 2550, moneda: "MXN", unidad: "persona", rangoMin: 150, rangoMax: 150 },
    { monto: 1800, moneda: "MXN", unidad: "persona", rangoMin: 300, rangoMax: 300 },
  ];

  it("usa la fecha default 2027 si falta", () => {
    const d = fechaConsultaDate();
    expect(d.toISOString()).toContain("2027-06-15");
    expect(FECHA_EVENTO_DEFAULT_CATALOGO).toBe("2027-06-15");
  });

  it("cotiza tramo exacto 150", () => {
    const m = matchPrecioPorAforo(tc, 150);
    expect(m.kind).toBe("exact");
    if (m.kind === "exact") {
      expect(m.row.monto).toBe(2550);
      expect(m.totalEvento).toBe(382500);
    }
  });

  it("no interpola aforo intermedio", () => {
    const m = matchPrecioPorAforo(tc, 120);
    expect(m.kind).toBe("sin_interpolar");
    if (m.kind === "sin_interpolar") {
      expect(m.tramosPublicados).toEqual([...AFORO_TRAMOS_BODA]);
    }
  });

  it("sin aforo usa el tramo 100 como desde", () => {
    const m = matchPrecioPorAforo(tc);
    expect(m.kind).toBe("desde");
    if (m.kind === "desde") {
      expect(m.row.monto).toBe(2980);
      expect(m.aforoTramo).toBe(100);
      expect(m.totalEvento).toBe(298000);
    }
  });

  it("alias de sede y SKU de prueba apuntan al catálogo 2027", () => {
    expect(sedeToCatalogSlug("jardin-1")).toBe("tequesquitengo");
    expect(sedeToCatalogSlug("Jardín 1")).toBe("tequesquitengo");
    expect(canonicalizeSku("BODA-J1-ESENCIAL")).toBe("EVT-J1-TC");
    expect(canonicalizeSku("BODA-J1-PREMIUM")).toBe("EVT-J1-PREMIUM");
  });
});
