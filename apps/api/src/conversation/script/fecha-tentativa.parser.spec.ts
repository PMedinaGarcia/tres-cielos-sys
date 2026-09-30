import {
  explainFechaTentativa,
  isBeforeMinAllowed,
  isValidCalendarDate,
  parseFechaTentativa,
  todayPartsMexico,
} from "./fecha-tentativa.parser";

const NOW = new Date("2026-08-25T18:00:00.000Z");

describe("parseFechaTentativa", () => {
  it("acepta ISO válido", () => {
    expect(parseFechaTentativa("2026-11-14", { now: NOW })).toEqual({
      tipo: "dia",
      fecha: "2026-11-14",
      flexible: false,
    });
  });

  it("rechaza ISO inválido de calendario", () => {
    expect(parseFechaTentativa("2026-13-40", { now: NOW })).toBeNull();
    expect(isValidCalendarDate(2026, 13, 40)).toBe(false);
  });

  it("rechaza fechas anteriores a hoy-1", () => {
    expect(parseFechaTentativa("2026-01-01", { now: NOW })).toBeNull();
    expect(isBeforeMinAllowed("2026-01-01", NOW)).toBe(true);
    expect(parseFechaTentativa("2026-08-24", { now: NOW })?.fecha).toBe(
      "2026-08-24",
    );
  });

  it("exige año en DMY corto y acepta DMY largo", () => {
    expect(parseFechaTentativa("15/03", { now: NOW })).toBeNull();
    expect(explainFechaTentativa("15/03", { now: NOW }).ok).toBe(false);
    if (!explainFechaTentativa("15/03", { now: NOW }).ok) {
      expect(explainFechaTentativa("15/03", { now: NOW })).toEqual({
        ok: false,
        motivo: "sin_anio",
      });
    }
    expect(parseFechaTentativa("15-03-2027", { now: NOW })?.fecha).toBe(
      "2027-03-15",
    );
    expect(parseFechaTentativa("15.03.2027", { now: NOW })?.fecha).toBe(
      "2027-03-15",
    );
  });

  it("exige año en coloquial día+mes", () => {
    expect(parseFechaTentativa("el 15 de marzo", { now: NOW })).toBeNull();
    expect(explainFechaTentativa("22 de diciembre", { now: NOW })).toEqual({
      ok: false,
      motivo: "sin_anio",
    });
    expect(
      parseFechaTentativa("15 de marzo de 2027", { now: NOW })?.fecha,
    ).toBe("2027-03-15");
    expect(
      parseFechaTentativa("22 de diciembre de 2026", { now: NOW })?.fecha,
    ).toBe("2026-12-22");
    expect(
      parseFechaTentativa("el 22 de diciembre del 2027", { now: NOW }),
    ).toEqual({
      tipo: "dia",
      fecha: "2027-12-22",
      flexible: false,
    });
  });

  it("acepta día + mes sin preposición de", () => {
    expect(
      parseFechaTentativa("22 Diciembre del 2026", { now: NOW }),
    ).toEqual({
      tipo: "dia",
      fecha: "2026-12-22",
      flexible: false,
    });
    expect(
      parseFechaTentativa("para el 22 Diciembre del 2026", { now: NOW }),
    ).toEqual({
      tipo: "dia",
      fecha: "2026-12-22",
      flexible: false,
    });
    expect(
      parseFechaTentativa("22 diciembre 2027", { now: NOW }),
    ).toEqual({
      tipo: "dia",
      fecha: "2027-12-22",
      flexible: false,
    });
    expect(
      explainFechaTentativa("22 diciembre", { now: NOW }),
    ).toEqual({ ok: false, motivo: "sin_anio" });
  });

  it("parsea marzo 2027 y noviembre del 2026", () => {
    expect(parseFechaTentativa("marzo 2027", { now: NOW })).toMatchObject({
      tipo: "mes",
      mes: 3,
      anio: 2027,
    });
    expect(
      parseFechaTentativa("noviembre del 2026", { now: NOW }),
    ).toMatchObject({ tipo: "mes", mes: 11, anio: 2026 });
    expect(parseFechaTentativa("nov 2026", { now: NOW })).toMatchObject({
      tipo: "mes",
      mes: 11,
      anio: 2026,
    });
    expect(parseFechaTentativa("setiembre 2027", { now: NOW })).toMatchObject({
      tipo: "mes",
      mes: 9,
      anio: 2027,
    });
  });

  it("febrero 27 es febrero de 2027, no el día 27 sin año", () => {
    expect(parseFechaTentativa("febrero 27", { now: NOW })).toEqual({
      tipo: "mes",
      mes: 2,
      anio: 2027,
      flexible: true,
    });
    expect(parseFechaTentativa("febrero del 27", { now: NOW })).toMatchObject({
      tipo: "mes",
      mes: 2,
      anio: 2027,
    });
    expect(parseFechaTentativa("Es en febrero 27", { now: NOW })).toMatchObject({
      tipo: "mes",
      mes: 2,
      anio: 2027,
    });
    expect(parseFechaTentativa("feb '27", { now: NOW })).toMatchObject({
      tipo: "mes",
      mes: 2,
      anio: 2027,
    });
    expect(explainFechaTentativa("febrero 15", { now: NOW })).toEqual({
      ok: false,
      motivo: "sin_anio",
    });
  });

  it("rechaza mes suelto sin año", () => {
    expect(explainFechaTentativa("en diciembre", { now: NOW })).toEqual({
      ok: false,
      motivo: "sin_anio",
    });
  });

  it("marca flexible en aprox / más o menos con año", () => {
    const r = parseFechaTentativa("pa'l 15 de marzo de 2027 masomenos", {
      now: NOW,
    });
    expect(r?.fecha).toBe("2027-03-15");
    expect(r?.flexible).toBe(true);
  });

  it("relativos: mañana y el sábado que viene", () => {
    expect(parseFechaTentativa("mañana", { now: NOW })?.fecha).toBe(
      "2026-08-26",
    );
    const sab = parseFechaTentativa("el sábado que viene", { now: NOW });
    expect(sab?.fecha).toBe("2026-08-29");
    expect(todayPartsMexico(NOW).iso).toBe("2026-08-25");
  });

  it("pa'l 20 / el 20 / el quince exigen año", () => {
    expect(
      explainFechaTentativa("pa'l 20", { now: NOW, paso: "fecha" }),
    ).toEqual({ ok: false, motivo: "sin_anio" });
    expect(
      explainFechaTentativa("el 20", { now: NOW, paso: "fecha" }),
    ).toEqual({ ok: false, motivo: "sin_anio" });
    expect(
      explainFechaTentativa("el quince", { now: NOW, paso: "fecha" }),
    ).toEqual({ ok: false, motivo: "sin_anio" });
    expect(
      parseFechaTentativa("el quince", { now: NOW, paso: "ocasion" }),
    ).toBeNull();
  });

  it("exige año en rangos", () => {
    expect(
      explainFechaTentativa("del 10 al 12 de noviembre", { now: NOW }),
    ).toEqual({ ok: false, motivo: "sin_anio" });
    expect(
      parseFechaTentativa("del 10 al 12 de noviembre de 2026", { now: NOW }),
    ).toEqual({
      tipo: "rango",
      desde: "2026-11-10",
      hasta: "2026-11-12",
      flexible: false,
    });
  });
});
