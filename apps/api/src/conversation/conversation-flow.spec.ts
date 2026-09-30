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
  scoreFit,
} from "./conversation-flow";
import { flowConfig } from "./__tests__/flow-config";

describe("conversationFlowVersion", () => {
  it("sin ConfigService queda en v1", () => {
    expect(conversationFlowVersion()).toBe("v1");
  });

  it("con Nest config el default es v2", () => {
    expect(conversationFlowVersion(flowConfig("v2"))).toBe("v2");
    expect(conversationFlowVersion(flowConfig("v1"))).toBe("v1");
    expect(conversationFlowVersion(flowConfig("v3"))).toBe("v3");
  });

  it("canary con v2 reparte v3 por hash estable y respeta persistido", () => {
    const cfg = flowConfig("v2", { canaryPct: 100 });
    expect(
      resolveConversationFlow(cfg, { threadId: "wa:canary" }),
    ).toBe("v3");
    expect(
      resolveConversationFlow(flowConfig("v2", { canaryPct: 0 }), {
        threadId: "wa:canary",
      }),
    ).toBe("v2");
    expect(
      resolveConversationFlow(flowConfig("v2", { canaryPct: 100 }), {
        threadId: "wa:x",
        persisted: "v2",
      }),
    ).toBe("v2");
    expect(hashCanaryBucket("sede-a")).toBe(hashCanaryBucket("sede-a"));
  });
});

describe("nextPasoGuionV2", () => {
  it("pide nombre_fecha si falta alguno", () => {
    expect(nextPasoGuionV2({ tipoEvento: "boda" })).toBe("nombre_fecha");
  });

  it("pide aclaración si el rango está por definir", () => {
    expect(
      nextPasoGuionV2({
        nombre: "Ana",
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
        aforo: 150,
        rangoInversion: "por_definir",
      }),
    ).toBe("aclaracion_piso");
  });

  it("por_definir sin aforo abre B3", () => {
    expect(
      nextPasoGuionV2({
        nombre: "Patricio",
        fechaTentativa: { tipo: "mes", mes: 2, anio: 2027, flexible: true },
        rangoInversion: "por_definir",
      }),
    ).toBe("aclaracion_piso");
  });
});

describe("isPrequalificadoV2", () => {
  it("encaje confirmado con fecha e intención no baja, sin aforo", () => {
    expect(
      isPrequalificadoV2({
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
        rangoInversion: "r350_499",
        encajeEconomico: "confirmado",
        intencionNivel: "alta",
      }),
    ).toBe(true);
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

  it("B2 pide rango; por_definir sin aforo abre B3", () => {
    expect(
      nextPasoGuionV3({
        nombre: "Ana",
        fechaTentativa: { tipo: "mes", mes: 12, anio: 2027, flexible: true },
        aforo: 150,
      }),
    ).toBe("aforo_inversion");
    expect(
      nextPasoGuionV3({
        nombre: "Ana",
        fechaTentativa: { tipo: "mes", mes: 12, anio: 2027, flexible: true },
        rangoInversion: "por_definir",
      }),
    ).toBe("aclaracion_piso");
  });

  it("scoreFit separa ejes", () => {
    const fit = scoreFit({
      nombre: "Ana",
      aforo: 150,
      rangoInversion: "r350_499",
      intencionNivel: "alta",
      fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
    });
    expect(fit.encaje).toBe("confirmado");
    expect(fit.intencion).toBe("alta");
    expect(fit.completitud).toBe("comercial");
  });
});
