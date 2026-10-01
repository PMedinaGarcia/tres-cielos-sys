import {
  conversationFlowVersion,
  deriveEncaje,
  deriveEncajeV3,
  fechaEstadoFrom,
  hashCanaryBucket,
  isCalificadoV3,
  isPrequalificadoV2,
  nextPasoGuionV2,
  nextPasoGuionV3,
  resolveConversationFlow,
} from "./conversation-flow";
import { flowConfig } from "./__tests__/flow-config";

describe("conversationFlowVersion", () => {
  it("sin config devuelve v1", () => {
    expect(conversationFlowVersion()).toBe("v1");
  });

  it("con config devuelve el flow configurado", () => {
    expect(conversationFlowVersion(flowConfig("v2"))).toBe("v2");
    expect(conversationFlowVersion(flowConfig("v1"))).toBe("v1");
    expect(conversationFlowVersion(flowConfig("v3"))).toBe("v3");
  });

  it("canary puede forzar v3", () => {
    const cfg = flowConfig("v2", { canaryPct: 100 });
    expect(
      resolveConversationFlow(cfg, {
        threadId: "wa:x",
      }),
    ).toBe("v3");
    expect(
      resolveConversationFlow(flowConfig("v2", { canaryPct: 0 }), {
        threadId: "wa:x",
      }),
    ).toBe("v2");
    expect(hashCanaryBucket("sede-a")).toBe(hashCanaryBucket("sede-a"));
  });
});

describe("nextPasoGuionV2", () => {
  it("pide nombre_fecha si falta alguno", () => {
    expect(nextPasoGuionV2({ tipoEvento: "boda" })).toBe("nombre_fecha");
  });

  it("con nombre y fecha va a accion (paquete) antes del PDF", () => {
    expect(
      nextPasoGuionV2({
        nombre: "Ana",
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
      }),
    ).toBe("accion");
  });

  it("tras PDF sin CTA permanece en accion", () => {
    expect(
      nextPasoGuionV2({
        nombre: "Ana",
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
        pdfEnviado: true,
      }),
    ).toBe("accion");
  });

  it("con PDF y CTA pasa a faq_libre", () => {
    expect(
      nextPasoGuionV2({
        nombre: "Ana",
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
        pdfEnviado: true,
        ctaGuion: "visita",
      }),
    ).toBe("faq_libre");
  });
});

describe("isPrequalificadoV2", () => {
  it("encaje confirmado con fecha, aforo e intención no baja", () => {
    expect(
      isPrequalificadoV2({
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
        aforo: 150,
        rangoInversion: "r350_499",
        encajeEconomico: "confirmado",
        intencionNivel: "alta",
      }),
    ).toBe(true);
  });

  it("sin aforo no precalifica", () => {
    expect(
      isPrequalificadoV2({
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
        rangoInversion: "r350_499",
        encajeEconomico: "confirmado",
        intencionNivel: "alta",
      }),
    ).toBe(false);
  });

  it("probable con rango suelto ≥ 250k se trata como confirmado", () => {
    expect(
      deriveEncaje({
        rangoInversion: "r250_349",
        encajeEconomico: "probable",
      }),
    ).toBe("confirmado");
  });
});

describe("v3 score y fecha", () => {
  it("mes o temporada es ventana", () => {
    expect(
      fechaEstadoFrom({
        fechaTentativa: { tipo: "mes", mes: 12, anio: 2027, flexible: true },
      }),
    ).toBe("ventana");
  });

  it("probable no se colapsa a confirmado", () => {
    expect(
      deriveEncajeV3({
        encajeEconomico: "probable",
        rangoInversion: "por_definir",
      }),
    ).toBe("probable");
  });

  it("calificado v3 con probable + aforo + intención media", () => {
    expect(
      isCalificadoV3({
        nombre: "Ana",
        encajeEconomico: "probable",
        aforo: 150,
        intencionNivel: "media",
        fechaEstado: "sin_definir",
      }),
    ).toBe(true);
  });

  it("v3 con nombre y fecha va a accion para paquete comercial", () => {
    expect(
      nextPasoGuionV3({
        nombre: "Ana",
        fechaTentativa: { tipo: "mes", mes: 12, anio: 2027, flexible: true },
      }),
    ).toBe("accion");
    expect(
      nextPasoGuionV3({
        nombre: "Ana",
        fechaTentativa: { tipo: "mes", mes: 12, anio: 2027, flexible: true },
        pdfEnviado: true,
        ctaGuion: "ejecutivo",
      }),
    ).toBe("faq_libre");
  });
});
