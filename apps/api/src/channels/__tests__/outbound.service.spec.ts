import { OutboundService, buildTwilioForms } from "../outbound.service";

describe("buildTwilioForms", () => {
  const from = "whatsapp:+15044147172";
  const to = "whatsapp:+5215512345678";

  it("texto de sesión es un solo Body", () => {
    const forms = buildTwilioForms({
      from,
      to,
      texto: "¡Perfecto! ¿Con quién tenemos el gusto?",
      wa: {
        templateId: "guion.nombre",
        kind: "text",
        body: "¡Perfecto! ¿Con quién tenemos el gusto?",
      },
    });
    expect(forms).toEqual([
      { From: from, To: to, Body: "¡Perfecto! ¿Con quién tenemos el gusto?" },
    ]);
  });

  it("el paquete sale como dos PDF y la lista, sin fotos ni repetir el body", () => {
    const forms = buildTwilioForms({
      from,
      to,
      texto: "Gracias, Ana. Te comparto dos PDF.",
      wa: {
        templateId: "guion.accion_cta",
        kind: "list-picker",
        body: "Gracias, Ana. Te comparto dos PDF.",
        contentSid: "HXaccion",
        contentVariables: { "1": "Ana" },
        list: {
          button: "Ver opciones",
          items: [{ id: "accion.visita", title: "Conocer Tres Cielos" }],
        },
        images: [
          { url: "https://api.example/cards/01.jpg", caption: "Jardín" },
        ],
        documents: [
          {
            filename: "Experiencia boda de tres días - 2027.pdf",
            mime: "application/pdf",
            url: "https://api.example/experiencia.pdf",
            delivery: "link",
          },
          {
            filename: "Tarifas 2027 - Tres Cielos.pdf",
            mime: "application/pdf",
            url: "https://api.example/tarifas.pdf",
            delivery: "media",
          },
        ],
      },
    });
    expect(forms.map((f) => f.MediaUrl ?? f.ContentSid ?? "text")).toEqual([
      "HXaccion",
      "https://api.example/tarifas.pdf",
      "text",
    ]);
    expect(forms[0]?.ContentVariables).toBe(JSON.stringify({ "1": "Ana" }));
    expect(forms[0]?.Body).toBeUndefined();
    expect(forms[1]?.Body).toBe("Tarifas 2027 - Tres Cielos.pdf");
    expect(forms[1]?.MediaUrl).toBe("https://api.example/tarifas.pdf");
    expect(forms[2]?.Body).toBe(
      "Experiencia boda de tres días - 2027.pdf\nhttps://api.example/experiencia.pdf",
    );
    expect(forms[2]?.MediaUrl).toBeUndefined();
    expect(forms.some((f) => f.MediaUrl?.includes("cards"))).toBe(false);
  });

  it("reintento de CTA no adjunta media", () => {
    const forms = buildTwilioForms({
      from,
      to,
      texto: "¿Cómo prefieres seguir?",
      wa: {
        templateId: "guion.accion_cta_retry",
        kind: "list-picker",
        body: "¿Cómo prefieres seguir?",
        contentSid: "HXretry",
        list: {
          button: "Ver opciones",
          items: [{ id: "accion.visita", title: "Conocer Tres Cielos" }],
        },
      },
    });
    expect(forms).toEqual([{ From: from, To: to, ContentSid: "HXretry" }]);
  });
});

describe("OutboundService.send Twilio", () => {
  const originalFetch = global.fetch;
  const env = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM,
  };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.TWILIO_ACCOUNT_SID = env.TWILIO_ACCOUNT_SID;
    process.env.TWILIO_AUTH_TOKEN = env.TWILIO_AUTH_TOKEN;
    process.env.TWILIO_WHATSAPP_FROM = env.TWILIO_WHATSAPP_FROM;
  });

  it("sin credenciales no llama a Twilio", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_FROM;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const svc = new OutboundService();
    const result = await svc.send({
      canal: "whatsapp",
      externalThreadId: "wa:+5215512345678",
      texto: "hola",
    });
    expect(result).toEqual({
      ok: true,
      skipped: true,
      reason: "TWILIO_ENV_MISSING",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posta cada parte y devuelve el último SID", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+15044147172";
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: "SM1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: "SM2" }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    const svc = new OutboundService();
    const result = await svc.send({
      canal: "whatsapp",
      externalThreadId: "wa:+5215512345678",
      texto: "pregunta",
      waContent: {
        templateId: "guion.fecha_ventana",
        kind: "list-picker",
        body: "elige",
        contentSid: "HXfecha",
        list: {
          button: "Ver opciones",
          items: [{ id: "fecha.jun_sep", title: "Jun-Sep 2027" }],
        },
        document: {
          filename: "Tarifas 2027 - Tres Cielos.pdf",
          mime: "application/pdf",
          url: "https://api.example/tarifas.pdf",
        },
      },
    });
    expect(result).toEqual({ ok: true, providerMessageId: "SM2" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = String(fetchMock.mock.calls[0]?.[1]?.body);
    expect(firstBody).toContain("ContentSid=HXfecha");
    const secondBody = String(fetchMock.mock.calls[1]?.[1]?.body);
    expect(secondBody).toContain("MediaUrl=");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/Accounts/ACtest/Messages.json",
    );
  });
});
