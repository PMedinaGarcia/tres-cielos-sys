import { TariffScrubService } from "../scrub/tariff-scrub.service";

describe("TariffScrubService", () => {
  const scrub = new TariffScrubService();

  it("marca no_recuperable_precio con montos MXN", () => {
    const r = scrub.scrub(
      "El paquete esencial cuesta $45,000 MXN con anticipo de 10000 pesos.",
    );
    expect(r.noRecuperablePrecio).toBe(true);
    expect(r.montosDetectados.length).toBeGreaterThanOrEqual(1);
    expect(scrub.extractRawAmounts(r.textoLimpio).length).toBe(0);
  });

  it("no marca prosa sin tarifas", () => {
    const r = scrub.scrub(
      "Horario de visitas martes a domingo. Políticas de lluvia en recepción.",
    );
    expect(r.noRecuperablePrecio).toBe(false);
  });

  it("detecta columna precio", () => {
    const r = scrub.scrub("tabla con columna Precio y descripción del venue");
    expect(r.noRecuperablePrecio).toBe(true);
  });
});
