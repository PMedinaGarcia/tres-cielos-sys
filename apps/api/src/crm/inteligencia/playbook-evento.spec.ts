import { derivarResumenComercialBot } from "./estado-comercial-bot";
import { inteligenciaInputDe } from "./inteligencia-input";
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

  it("perfil + pedido false → perfilando", () => {
    const r = derivarInteligencia({
      ...base,
      tipoEvento: "boda",
      perfilCompleto: true,
      pedidoCotizacion: false,
      intencionCotizar: false,
      pasoGuion: "faq_libre",
    });
    expect(r.etapaCotizacion).toBe("perfilando");
  });

  it("perfil + pedido true sin SKU → explorando", () => {
    const r = derivarInteligencia({
      ...base,
      tipoEvento: "boda",
      perfilCompleto: true,
      pedidoCotizacion: true,
      intencionCotizar: true,
    });
    expect(r.etapaCotizacion).toBe("explorando");
    expect(r.siguienteAccion).toBe("Seguir calificación");
  });
});

const resumenBase = {
  etapa: "nuevo_bot",
  etapaCotizacion: "perfilando" as const,
  listoParaCotizar: false,
  visitaEstado: "no_solicitada",
  intencionVisita: false,
  propuestaEnviadaEn: null,
  campos: {},
};

describe("derivarResumenComercialBot", () => {
  it("v4 ventana de fecha sin aforo deja la cotización en perfilando y muestra Ventana", () => {
    const intel = derivarInteligencia({
      ...base,
      tipoEvento: null,
      pasoGuion: "fecha_ventana",
      perfilCompleto: false,
    });
    const r = derivarResumenComercialBot({
      ...resumenBase,
      etapaCotizacion: intel.etapaCotizacion,
      pasoGuion: "fecha_ventana",
      estadoBot: "activo",
      campos: { fechaEstado: "ventana" },
    });
    expect(intel.etapaCotizacion).toBe("perfilando");
    expect(r.titulo).toBe("Ventana de fecha");
    expect(r.capturas.find((c) => c.id === "fecha")).toMatchObject({
      valor: "Ventana",
      estado: "ok",
    });
    expect(r.capturas.find((c) => c.id === "presupuesto")?.estado).toBe(
      "pendiente",
    );
  });

  it("PDF enviado sin CTA pide elegir cómo seguir", () => {
    const r = derivarResumenComercialBot({
      ...resumenBase,
      pasoGuion: "accion",
      campos: { pdfEnviado: true },
    });
    expect(r.titulo).toBe("Elige cómo seguir");
    expect(r.siguienteParaAsesor).toBe(
      "Esperar elección: visita, ejecutivo o presupuesto",
    );
    expect(r.capturas.find((c) => c.id === "accion")).toMatchObject({
      valor: "Elige cómo seguir",
      estado: "pendiente",
    });
  });

  it("escalado con CTA de visita pide agendar", () => {
    const r = derivarResumenComercialBot({
      ...resumenBase,
      estadoBot: "escalado",
      visitaEstado: "solicitada",
      intencionVisita: true,
      rutaComercial: "handoff",
      campos: { ctaGuion: "visita", pdfEnviado: true },
    });
    expect(r.titulo).toBe("Pidió agendar visita");
    expect(r.siguienteParaAsesor).toBe("Agendar visita");
    expect(r.capturas.find((c) => c.id === "accion")?.valor).toBe(
      "Agendar visita",
    );
  });

  it("CTA de ejecutivo es handoff comercial", () => {
    const r = derivarResumenComercialBot({
      ...resumenBase,
      estadoBot: "escalado",
      rutaComercial: "handoff",
      campos: { ctaGuion: "ejecutivo", pdfEnviado: true },
    });
    expect(r.titulo).toBe("Pidió hablar con ejecutivo");
    expect(r.siguienteParaAsesor).toBe("Contactar (ejecutivo)");
  });

  it("fuera de presupuesto con rango entra a nutrición", () => {
    const r = derivarResumenComercialBot({
      ...resumenBase,
      pasoGuion: "faq_libre",
      rutaComercial: "nutricion",
      campos: {
        ctaGuion: "fuera_presupuesto",
        rangoPresupuestoFuera: "r200_250",
        pdfEnviado: true,
      },
    });
    expect(r.titulo).toBe("Fuera de presupuesto (200–250 mil)");
    expect(r.siguienteParaAsesor).toBe("Dar seguimiento (nutrición)");
    expect(r.capturas.find((c) => c.id === "presupuesto")).toMatchObject({
      valor: "200–250 mil",
      estado: "ok",
    });
    expect(r.capturas.find((c) => c.id === "accion")?.valor).toBe(
      "Fuera de presupuesto",
    );
  });

  it("ruta seguimiento nombra la intención baja", () => {
    const r = derivarResumenComercialBot({
      ...resumenBase,
      rutaComercial: "seguimiento",
      campos: { rangoInversion: "r350_499", encajeEconomico: "confirmado" },
    });
    expect(r.titulo).toBe("Seguimiento (intención baja)");
    expect(r.siguienteParaAsesor).toBe("Dar seguimiento");
  });

  it("listo para cotizar con visita conserva el presupuesto y pide agendar", () => {
    const r = derivarResumenComercialBot({
      ...resumenBase,
      etapaCotizacion: "listo_para_cotizar",
      listoParaCotizar: true,
      visitaEstado: "solicitada",
      intencionVisita: true,
      fechaColumna: "2026-11-14T00:00:00.000Z",
      campos: {
        rangoInversion: "r350_499",
        fechaEstado: "definida",
        fechaTentativa: { tipo: "dia", fecha: "2026-11-14", flexible: false },
      },
    });
    expect(r.titulo).toBe("Listo para cotizar — 350–499 mil");
    expect(r.siguienteParaAsesor).toBe("Agendar visita");
    expect(r.capturas.map((c) => c.estado)).toEqual(["ok", "ok", "ok"]);
    expect(r.capturas.find((c) => c.id === "presupuesto")?.valor).toBe(
      "350–499 mil",
    );
    expect(r.capturas.find((c) => c.id === "accion")?.valor).toBe(
      "Visita sin agendar",
    );
  });

  it("escalado de atención general no se confunde con ejecutivo", () => {
    const r = derivarResumenComercialBot({
      ...resumenBase,
      estadoBot: "escalado",
      cola: "atencion_general",
      rutaComercial: "atencion_general",
      campos: {},
    });
    expect(r.titulo).toBe("Atención general");
    expect(r.siguienteParaAsesor).toBe("Contactar (atención general)");
  });

  it("v2 en aclaración de piso sin rango aún no salta a nutrición", () => {
    const r = derivarResumenComercialBot({
      ...resumenBase,
      pasoGuion: "aclaracion_piso",
      campos: { encajeEconomico: "no_confirmado" },
    });
    expect(r.titulo).toBe("Piso de inversión");
    expect(r.siguienteParaAsesor).toBe("Confirmar piso de 250 mil");
  });
});

describe("inteligenciaInputDe", () => {
  it("completa el perfil con campos del guion aunque las columnas vengan vacías", () => {
    const input = inteligenciaInputDe({
      tipoEvento: null,
      calificacion: "en_exploracion",
      listoParaCotizar: false,
      paqueteTentativoId: null,
      etapa: "nuevo_bot",
      propuestaEnviadaEn: null,
      visitaEstado: "no_solicitada",
      intencionVisita: false,
      fechaTentativa: null,
      aforo: null,
      sede: null,
      campos: {
        nombre: "Ana López",
        tipoEvento: "boda",
        fechaTentativa: { tipo: "dia", fecha: "2026-12-12", flexible: false },
        aforo: 120,
        sedeNombre: "Jardín",
        intencionCotizar: true,
      },
      ultimoContactoEn: new Date(),
    });
    expect(input.perfilCompleto).toBe(true);
    expect(input.intencionCotizar).toBe(true);
    expect(input.pedidoCotizacion).toBe(true);
  });

  it("respeta el pedido explícito del turno por encima de la intención guardada", () => {
    const input = inteligenciaInputDe({
      tipoEvento: "boda",
      calificacion: "en_exploracion",
      listoParaCotizar: false,
      paqueteTentativoId: null,
      etapa: "nuevo_bot",
      propuestaEnviadaEn: null,
      visitaEstado: "no_solicitada",
      intencionVisita: false,
      campos: { intencionCotizar: true },
      pedidoCotizacion: false,
      ultimoContactoEn: new Date(),
    });
    expect(input.pedidoCotizacion).toBe(false);
  });
});
