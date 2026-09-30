import {
  ACLARACION_NO_PAYLOAD,
  applyRangoHarvest,
  parseAceptaPiso,
  parseIntencionNivel,
  parseMontoMxn,
  parseRangoInversion,
  rangoFromMonto,
} from "./harvest-rango";

describe("harvest-rango", () => {
  it("mapea payloads de list-picker a rangos sin traslape", () => {
    expect(parseRangoInversion("inversion.r250_349")).toEqual({
      rango: "r250_349",
      encaje: "confirmado",
    });
    expect(parseRangoInversion("inversion.r350_499")?.rango).toBe("r350_499");
    expect(parseRangoInversion("inversion.r500_mas")?.rango).toBe("r500_mas");
    expect(parseRangoInversion("inversion.por_definir")).toEqual({
      rango: "por_definir",
      encaje: "no_confirmado",
    });
  });

  it("normaliza montos ≥ 250k al rango que los contiene", () => {
    expect(rangoFromMonto(250_000)).toBe("r250_349");
    expect(rangoFromMonto(349_000)).toBe("r250_349");
    expect(rangoFromMonto(350_000)).toBe("r350_499");
    expect(rangoFromMonto(500_000)).toBe("r500_mas");
    expect(parseRangoInversion("presupuesto 350 mil")?.encaje).toBe("confirmado");
    expect(parseRangoInversion("presupuesto 350 mil")?.rango).toBe("r350_499");
    expect(parseRangoInversion("presupuesto 280 mil")?.encaje).toBe("confirmado");
  });

  it("cifra ambigua cerca del piso queda no_confirmado", () => {
    expect(parseRangoInversion("alrededor de 250 mil")).toEqual({
      rango: "por_definir",
      encaje: "no_confirmado",
      monto: 250_000,
    });
  });

  it("marca encaje no por debajo del piso", () => {
    expect(parseRangoInversion("presupuesto 180 mil")).toEqual({
      rango: "menor_250",
      encaje: "no",
      monto: 180_000,
    });
    expect(parseMontoMxn("con $180,000 mxn")).toBe(180_000);
    expect(applyRangoHarvest("presupuesto 180 mil", {})).toEqual({
      rangoInversion: "menor_250",
      encajeEconomico: "no",
    });
  });

  it("separa rechazo de piso y evasión de B3", () => {
    expect(parseAceptaPiso("Buscamos algo menor")).toBe(false);
    expect(parseAceptaPiso(ACLARACION_NO_PAYLOAD)).toBe(false);
    expect(parseAceptaPiso("todavía no")).toBeNull();
    expect(parseAceptaPiso("Sí, lo consideramos")).toBe(true);
  });

  it("infiere intención alta / media / baja", () => {
    expect(parseIntencionNivel("quiero cotizar y visitar")).toBe("alta");
    expect(parseIntencionNivel("quiero comparar opciones")).toBe("media");
    expect(parseIntencionNivel("solo información general")).toBe("baja");
  });
});
