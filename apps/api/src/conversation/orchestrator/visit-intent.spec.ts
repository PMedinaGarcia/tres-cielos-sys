import { isIntencionVisita } from "./visit-intent";

describe("isIntencionVisita", () => {
  it.each([
    "quiero visitar",
    "conocer el jardin",
    "agendar cita",
    "agendar visita",
    "horario de visitas",
    "tour del venue",
  ])("detecta %s", (texto) => {
    expect(isIntencionVisita(texto)).toBe(true);
  });

  it.each([
    "horario de evento",
    "cierre 02:00",
    "11 horas de jardín",
    "cuánto cuesta el paquete",
    "Politicas",
  ])("no dispara con %s", (texto) => {
    expect(isIntencionVisita(texto)).toBe(false);
  });
});
