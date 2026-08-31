import { isLocationQuery } from "./location-intent";

describe("isLocationQuery", () => {
  it("detecta dirección, dónde queda, cómo llego y maps", () => {
    expect(isLocationQuery("dónde queda el jardín")).toBe(true);
    expect(isLocationQuery("cuál es la dirección")).toBe(true);
    expect(isLocationQuery("cómo llego")).toBe(true);
    expect(isLocationQuery("cómo llegar a Tres Cielos")).toBe(true);
    expect(isLocationQuery("pásame el waze")).toBe(true);
    expect(isLocationQuery("tienen pin de maps")).toBe(true);
    expect(isLocationQuery("dónde están en Tequesquitengo")).toBe(true);
  });

  it("no trata visita ni paquetes como ubicación", () => {
    expect(isLocationQuery("quiero visitar")).toBe(false);
    expect(isLocationQuery("conocer el jardin")).toBe(false);
    expect(isLocationQuery("paquete tequesquitengo")).toBe(false);
    expect(isLocationQuery("María López")).toBe(false);
  });
});
