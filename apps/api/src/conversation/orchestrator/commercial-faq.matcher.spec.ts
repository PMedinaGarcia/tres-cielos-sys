import {
  isPackageDetailQuery,
  matchCommercialFaqTopic,
} from "./commercial-faq.matcher";

describe("commercial-faq.matcher", () => {
  it("resuelve políticas mal formadas al overview", () => {
    expect(matchCommercialFaqTopic("Politicas")).toBe("overview");
    expect(matchCommercialFaqTopic("políticas")).toBe("overview");
    expect(matchCommercialFaqTopic("politcas")).toBe("overview");
    expect(matchCommercialFaqTopic("condiciones")).toBe("overview");
  });

  it("separa horario, pago y exclusiones", () => {
    expect(matchCommercialFaqTopic("Horarios")).toBe("horario");
    expect(matchCommercialFaqTopic("orarios")).toBe("horario");
    expect(matchCommercialFaqTopic("politicas de pago")).toBe("pago");
    expect(matchCommercialFaqTopic("anticipo")).toBe("pago");
    expect(matchCommercialFaqTopic("exclusiones")).toBe("exclusiones");
    expect(matchCommercialFaqTopic("que no incluye")).toBe("exclusiones");
  });

  it("fecha mínima de contratación no se inventa", () => {
    expect(matchCommercialFaqTopic("fecha minima de contratacion")).toBe(
      "fecha_minima",
    );
    expect(
      matchCommercialFaqTopic("con cuanto tiempo hay que contratar"),
    ).toBe("fecha_minima");
  });

  it("no trata venue (ubicación/estacionamiento) como FAQ comercial", () => {
    expect(matchCommercialFaqTopic("política de estacionamiento")).toBeNull();
    expect(matchCommercialFaqTopic("cuál es la ubicación del venue")).toBeNull();
  });

  it("detecta detalle de paquete con texto mal formado", () => {
    expect(isPackageDetailQuery("que tiene el estandar")).toBe(true);
    expect(isPackageDetailQuery("qué incluye el premium")).toBe(true);
    expect(isPackageDetailQuery("detalle del paquete")).toBe(true);
    expect(isPackageDetailQuery("qué incluye")).toBe(true);
    expect(isPackageDetailQuery("qué paquetes tienen")).toBe(false);
    expect(isPackageDetailQuery("tiene estacionamiento")).toBe(false);
    expect(matchCommercialFaqTopic("que tiene el estandar")).toBeNull();
  });
});
