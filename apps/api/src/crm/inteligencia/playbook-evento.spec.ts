import {
  derivarInteligencia,
  ESTANCAMIENTO_MS,
  playbookCotizacion,
} from "./playbook-evento";

const base = {
  calificacion: "en_exploracion",
  listoParaCotizar: false,
  paqueteTentativoId: null as string | null,
  etapa: "nuevo_bot",
  propuestaEnviadaEn: null as Date | null,
  visitaEstado: "no_solicitada",
  intencionVisita: false,
  ultimoContactoEn: new Date(),
  estadoAtencion: "bot_activo",
};

describe("playbookCotizacion", () => {
  it("boda usa catálogo; XV no", () => {
    expect(playbookCotizacion("boda").map((p) => p.id)).toContain(
      "listo_para_cotizar",
    );
    expect(playbookCotizacion("xv").map((p) => p.id)).toContain("sin_tarifa");
    expect(playbookCotizacion("xv").map((p) => p.id)).not.toContain(
      "explorando",
    );
  });
});

describe("derivarInteligencia", () => {
  it("boda con SKU listo → listo_para_cotizar", () => {
    const r = derivarInteligencia({
      ...base,
      tipoEvento: "boda",
      calificacion: "calificado",
      listoParaCotizar: true,
      paqueteTentativoId: "pkg-1",
      perfilCompleto: true,
    });
    expect(r.etapaCotizacion).toBe("listo_para_cotizar");
    expect(r.siguienteAccion).toBe("Enviar propuesta");
  });

  it("XV con sin_catalogo → sin_tarifa", () => {
    const r = derivarInteligencia({
      ...base,
      tipoEvento: "xv",
      motivoHandoff: "sin_catalogo",
      perfilCompleto: true,
      pasoGuion: "faq_libre",
    });
    expect(r.etapaCotizacion).toBe("sin_tarifa");
    expect(r.siguienteAccion).toBe("Cotizar a medida");
  });

  it("visita solicitada no pisa cotización", () => {
    const r = derivarInteligencia({
      ...base,
      tipoEvento: "boda",
      listoParaCotizar: true,
      paqueteTentativoId: "pkg-1",
      visitaEstado: "solicitada",
      intencionVisita: true,
      perfilCompleto: true,
    });
    expect(r.etapaCotizacion).toBe("listo_para_cotizar");
    expect(r.visitaEstado).toBe("solicitada");
    expect(r.siguienteAccion).toBe("Agendar visita");
  });

  it("estancado tras 24 h", () => {
    const r = derivarInteligencia({
      ...base,
      tipoEvento: "boda",
      pasoGuion: "faq_libre",
      ultimaRuta: "catalogo",
      ultimoContactoEn: new Date(Date.now() - ESTANCAMIENTO_MS - 1000),
    });
    expect(r.estancado).toBe(true);
    expect(r.siguienteAccion).toBe("Recontactar");
  });
});
