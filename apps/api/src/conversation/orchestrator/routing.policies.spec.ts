import {
  classifyIntentLexical,
  decideRoute,
  detectForcedHandoff,
  isAdjuntoSoportado,
} from "./routing.policies";

describe("routing.policies (D-BOT-1)", () => {
  it("detecta handoff forzado por pedido humano", () => {
    const r = detectForcedHandoff("Quiero hablar con un asesor por favor");
    expect(r.handoff).toBe(true);
    expect(r.motivo).toBe("solicitud_usuario");
  });

  it("payload hablar_asesor escala aunque el texto no lo pida", () => {
    const r = detectForcedHandoff("ok", "hablar_asesor");
    expect(r.handoff).toBe(true);
    expect(r.motivo).toBe("solicitud_usuario");
  });

  it("detecta queja → handoff", () => {
    expect(detectForcedHandoff("esto es una queja formal").motivo).toBe("queja");
  });

  it("clasifica datos_duros por precio", () => {
    expect(
      classifyIntentLexical("¿Cuánto cuesta el paquete BODA-J1-ESENCIAL?", "faq_libre"),
    ).toBe("datos_duros");
  });

  it("clasifica datos_duros con typos (kuanto / pakete)", () => {
    expect(
      classifyIntentLexical("kiero saber kuanto sale el esencial", "faq_libre"),
    ).toBe("datos_duros");
  });

  it("clasifica datos_duros con plurales y typos de precio", () => {
    expect(classifyIntentLexical("Que precios manejan", "faq_libre")).toBe(
      "datos_duros",
    );
    expect(classifyIntentLexical("Preico", "faq_libre")).toBe("datos_duros");
    expect(classifyIntentLexical("quiero cotizar", "faq_libre")).toBe(
      "datos_duros",
    );
    expect(classifyIntentLexical("qué paquetes tienen", "faq_libre")).toBe(
      "datos_duros",
    );
  });

  it("clasifica documental", () => {
    expect(
      classifyIntentLexical("¿Cuál es la ubicación del jardín?", "faq_libre"),
    ).toBe("pregunta_documental");
    expect(classifyIntentLexical("dónde queda", "faq_libre")).toBe(
      "pregunta_documental",
    );
    expect(classifyIntentLexical("cuál es la dirección", "faq_libre")).toBe(
      "pregunta_documental",
    );
    expect(classifyIntentLexical("cómo llego", "faq_libre")).toBe(
      "pregunta_documental",
    );
    expect(classifyIntentLexical("waze", "faq_libre")).toBe(
      "pregunta_documental",
    );
  });

  it("orden: estado ≠ activo → silencio", () => {
    expect(
      decideRoute({
        estadoBot: "escalado",
        hardQuota: false,
        texto: "hola",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "datos_duros",
      }).kind,
    ).toBe("silencio");
  });

  it("orden: hard quota → quota_hard", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: true,
        texto: "precio",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "datos_duros",
      }).kind,
    ).toBe("quota_hard");
  });

  it("orden: handoff forzado antes que catálogo", () => {
    const d = decideRoute({
      estadoBot: "activo",
      hardQuota: false,
      texto: "quiero hablar con un humano",
      pasoGuion: "faq_libre",
      capturaPendiente: false,
      adjuntoInvalido: false,
      intent: "solicitud_humana",
    });
    expect(d).toEqual({ kind: "handoff", motivo: "solicitud_usuario" });
  });

  it("payload hablar_asesor interrumpe el guion en nombre", () => {
    const d = decideRoute({
      estadoBot: "activo",
      hardQuota: false,
      texto: "ok",
      pasoGuion: "nombre",
      capturaPendiente: true,
      adjuntoInvalido: false,
      intent: "guion_captura",
      buttonPayload: "hablar_asesor",
    });
    expect(d).toEqual({ kind: "handoff", motivo: "solicitud_usuario" });
  });

  it("orden: guion cuando captura pendiente", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "María López",
        pasoGuion: "nombre",
        capturaPendiente: true,
        adjuntoInvalido: false,
        intent: "guion_captura",
      }).kind,
    ).toBe("guion");
  });

  it("captura pendiente + ubicación → faq_comercial (no rag ni guion)", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "dónde queda el jardín",
        pasoGuion: "nombre",
        capturaPendiente: true,
        adjuntoInvalido: false,
        intent: "pregunta_documental",
      }).kind,
    ).toBe("faq_comercial");
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "cuál es la dirección",
        pasoGuion: "aforo",
        capturaPendiente: true,
        adjuntoInvalido: false,
        intent: "guion_captura",
      }).kind,
    ).toBe("faq_comercial");
  });

  it("captura pendiente + visita sigue en guion", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "quiero visitar",
        pasoGuion: "nombre",
        capturaPendiente: true,
        adjuntoInvalido: false,
        intent: "ambiguo",
      }).kind,
    ).toBe("guion");
  });

  it("captura pendiente + datos_duros → guion (precio no interrumpe)", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "¿cuánto cuesta BODA-J1-ESENCIAL?",
        pasoGuion: "aforo",
        capturaPendiente: true,
        adjuntoInvalido: false,
        intent: "datos_duros",
      }).kind,
    ).toBe("guion");
  });

  it("faq_libre + datos_duros → catálogo", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "¿cuánto cuesta BODA-J1-ESENCIAL?",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "datos_duros",
      }).kind,
    ).toBe("catalogo");
  });

  it("clasifica detalle de paquete mal formado como datos_duros", () => {
    expect(classifyIntentLexical("que tiene el estandar", "faq_libre")).toBe(
      "datos_duros",
    );
    expect(classifyIntentLexical("Politicas", "faq_libre")).not.toBe(
      "pregunta_documental",
    );
  });

  it("ubicación en faq_libre → faq_comercial, no rag", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "cuál es la ubicación del venue",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "pregunta_documental",
      }).kind,
    ).toBe("faq_comercial");
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "dónde queda",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "pregunta_documental",
      }).kind,
    ).toBe("faq_comercial");
  });

  it("documental de venue (estacionamiento) → rag", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "política de estacionamiento",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "pregunta_documental",
      }).kind,
    ).toBe("rag");
  });

  it("Politicas en faq_libre → faq_comercial, no rag", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "Politicas",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "ambiguo",
      }).kind,
    ).toBe("faq_comercial");
  });

  it("quiero visitar en faq_libre → faq_comercial, no rag", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "quiero visitar",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "ambiguo",
      }).kind,
    ).toBe("faq_comercial");
  });

  it("conocer el jardin no va a RAG de ubicación", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "quiero conocer el jardin",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "pregunta_documental",
      }).kind,
    ).toBe("faq_comercial");
  });

  it("fecha mínima de contratación → handoff", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "fecha minima de contratacion",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "ambiguo",
      }),
    ).toEqual({ kind: "handoff", motivo: "otro" });
  });

  it("FAQ comercial no interrumpe captura de guion", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "Politicas",
        pasoGuion: "nombre",
        capturaPendiente: true,
        adjuntoInvalido: false,
        intent: "guion_captura",
      }).kind,
    ).toBe("guion");
  });

  it("adjunto inválido → handoff", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "mira esto",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: true,
        intent: "ambiguo",
      }),
    ).toEqual({ kind: "handoff", motivo: "adjunto_no_soportado" });
  });

  it("perfil listo + pedido + guion_captura → catálogo", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "Paty",
        pasoGuion: "nombre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "guion_captura",
        pedidoCotizacion: true,
        perfilListo: true,
      }).kind,
    ).toBe("catalogo");
  });

  it("captura pendiente gana aunque haya pedido y perfil listo", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "Paty",
        pasoGuion: "nombre",
        capturaPendiente: true,
        adjuntoInvalido: false,
        intent: "guion_captura",
        pedidoCotizacion: true,
        perfilListo: true,
      }).kind,
    ).toBe("guion");
  });

  it("faq_libre + recotizarPorSlots + ambiguo → catálogo", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "Para el 22 de Enero de 2027 entonces",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "ambiguo",
        perfilListo: true,
        recotizarPorSlots: true,
      }).kind,
    ).toBe("catalogo");
  });

  it("ubicación gana a recotizarPorSlots", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "cómo llego el 22 de enero de 2027",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "pregunta_documental",
        perfilListo: true,
        recotizarPorSlots: true,
      }).kind,
    ).toBe("faq_comercial");
  });

  it("documental de venue gana a recotizarPorSlots", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "política de estacionamiento el 22 de enero de 2027",
        pasoGuion: "faq_libre",
        capturaPendiente: false,
        adjuntoInvalido: false,
        intent: "pregunta_documental",
        perfilListo: true,
        recotizarPorSlots: true,
      }).kind,
    ).toBe("rag");
  });

  it("captura pendiente gana a recotizarPorSlots", () => {
    expect(
      decideRoute({
        estadoBot: "activo",
        hardQuota: false,
        texto: "22 de enero de 2027",
        pasoGuion: "fecha",
        capturaPendiente: true,
        adjuntoInvalido: false,
        intent: "guion_captura",
        perfilListo: false,
        recotizarPorSlots: true,
      }).kind,
    ).toBe("guion");
  });

  it("MIME no soportado", () => {
    expect(isAdjuntoSoportado({ mimeType: "application/zip" })).toBe(false);
    expect(isAdjuntoSoportado({ mimeType: "image/jpeg" })).toBe(true);
    expect(
      isAdjuntoSoportado({ mimeType: "video/mp4", duracionSec: 400 }),
    ).toBe(false);
  });
});
