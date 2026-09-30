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

describe("routing.policies v2", () => {
  const base = {
    estadoBot: "activo" as const,
    hardQuota: false,
    adjuntoInvalido: false,
    flow: "v2" as const,
    pasoGuion: "nombre_fecha" as const,
    capturaPendiente: true,
    intent: "guion_captura" as const,
  };

  it("precalificado → jump_visita", () => {
    const r = decideRoute({
      ...base,
      texto: "quiero visita",
      capturaPendiente: false,
      campos: {
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
        aforo: 150,
        rangoInversion: "r350_499",
        encajeEconomico: "confirmado",
        intencionNivel: "alta",
      },
    });
    expect(r.kind).toBe("jump_visita");
  });

  it("por_definir con tope de captura no cierra: B3 pendiente", () => {
    const r = decideRoute({
      ...base,
      texto: "aún por definir",
      capturaPendiente: true,
      pasoGuion: "aforo_inversion",
      campos: {
        rangoInversion: "por_definir",
        encajeEconomico: "no_confirmado",
        numeroAclaracionesPiso: 0,
        numeroMensajesCaptura: 3,
      },
    });
    expect(r.kind).toBe("guion");
  });

  it("menor al piso → nutrición sin cola comercial", () => {
    const r = decideRoute({
      ...base,
      texto: "quiero precios",
      intent: "datos_duros",
      campos: { encajeEconomico: "no" },
    });
    expect(r).toEqual({ kind: "nutricion", motivo: "menor_piso" });
  });

  it("encaje no se queda en nutrición salvo asesor", () => {
    expect(
      decideRoute({
        ...base,
        texto: "Quiero conocer",
        intent: "ambiguo",
        capturaPendiente: false,
        pasoGuion: "faq_libre",
        campos: {
          encajeEconomico: "no",
          rutaComercial: "nutricion",
        },
      }),
    ).toEqual({ kind: "nutricion", motivo: "menor_piso" });
    const humano = decideRoute({
      ...base,
      texto: "Quiero hablar con un asesor",
      intent: "solicitud_humana",
      capturaPendiente: false,
      pasoGuion: "faq_libre",
      campos: {
        encajeEconomico: "no",
        rutaComercial: "nutricion",
      },
    });
    expect(humano.kind).toBe("handoff");
  });

  it("pide humano en B1 → atención general", () => {
    const r = decideRoute({
      ...base,
      texto: "Quiero hablar con un asesor",
      intent: "solicitud_humana",
      campos: {},
    });
    expect(r.kind).toBe("handoff");
    if (r.kind === "handoff") {
      expect(r.cola).toBe("atencion_general");
    }
  });

  it("límite de 1 aclaración: tras evasión → nutrición", () => {
    const r = decideRoute({
      ...base,
      texto: "luego veo",
      capturaPendiente: false,
      pasoGuion: "faq_libre",
      campos: {
        rangoInversion: "por_definir",
        encajeEconomico: "no_confirmado",
        numeroAclaracionesPiso: 1,
      },
    });
    expect(r).toEqual({ kind: "nutricion", motivo: "evasion" });
  });

  it("tope de 3 mensajes de captura → nutrición", () => {
    const r = decideRoute({
      ...base,
      texto: "ok",
      campos: {
        numeroMensajesCaptura: 3,
        encajeEconomico: "no_confirmado",
      },
    });
    expect(r).toEqual({ kind: "nutricion", motivo: "evasion" });
  });
});

describe("routing.policies v3", () => {
  const base = {
    estadoBot: "activo" as const,
    hardQuota: false,
    adjuntoInvalido: false,
    flow: "v3" as const,
    pasoGuion: "nombre_fecha" as const,
    capturaPendiente: true,
    intent: "guion_captura" as const,
  };

  it("precio en captura → answer_inline", () => {
    const r = decideRoute({
      ...base,
      texto: "¿cuánto cuesta una boda?",
      intent: "datos_duros",
    });
    expect(r.kind).toBe("answer_inline");
  });

  it("fecha_minima → faq inline", () => {
    const r = decideRoute({
      ...base,
      texto: "fecha minima de contratacion",
      capturaPendiente: false,
    });
    expect(r.kind).toBe("faq_comercial");
  });

  it("quota dura → degrade_script", () => {
    expect(decideRoute({ ...base, hardQuota: true, texto: "hola" }).kind).toBe(
      "degrade_script",
    );
  });

  it("visita + encaje confirmado → jump_visita", () => {
    const r = decideRoute({
      ...base,
      texto: "quiero visitar el jardín",
      capturaPendiente: false,
      campos: {
        rangoInversion: "r350_499",
        encajeEconomico: "confirmado",
        aforo: 150,
        intencionNivel: "alta",
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
      },
    });
    expect(r.kind).toBe("jump_visita");
  });

  it("queja → cola general", () => {
    const r = decideRoute({
      ...base,
      texto: "esto es una queja formal",
      intent: "solicitud_humana",
    });
    expect(r.kind).toBe("handoff");
    if (r.kind === "handoff") expect(r.cola).toBe("atencion_general");
  });

  it("adjunto inválido primer intento → retry", () => {
    expect(
      decideRoute({ ...base, texto: "foto", adjuntoInvalido: true }).kind,
    ).toBe("adjunto_retry");
  });

  it("a futuro → nutrición", () => {
    expect(
      decideRoute({ ...base, texto: "lo vemos a futuro", capturaPendiente: false })
        .kind,
    ).toBe("nutricion");
  });
});

