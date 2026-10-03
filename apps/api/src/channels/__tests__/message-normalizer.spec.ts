import { MessageNormalizerService } from "../message-normalizer.service";

describe("MessageNormalizerService.fromTwilioWhatsApp", () => {
  const normalizer = new MessageNormalizerService();

  it("lee ButtonPayload y ButtonText", () => {
    const msg = normalizer.fromTwilioWhatsApp({
      From: "whatsapp:+5215550001111",
      Body: "Hablar con asesor",
      MessageSid: "SM-btn",
      ButtonPayload: "hablar_asesor",
      ButtonText: "Hablar con asesor",
      AccountSid: "AC-test",
    });
    expect(msg.buttonPayload).toBe("hablar_asesor");
    expect(msg.texto).toBe("Hablar con asesor");
    expect(msg.externalThreadId).toBe("wa:+5215550001111");
  });

  it("lee ListId y ListTitle si no hay Body", () => {
    const msg = normalizer.fromTwilioWhatsApp({
      From: "whatsapp:+5215550002222",
      MessageSid: "SM-list",
      ListId: "ocasion.boda",
      ListTitle: "Boda",
    });
    expect(msg.buttonPayload).toBe("ocasion.boda");
    expect(msg.texto).toBe("Boda");
  });
});

describe("MessageNormalizerService.fromMeta", () => {
  const normalizer = new MessageNormalizerService();

  it("lee nombre, wa_id y text.body de Cloud API", () => {
    const [msg] = normalizer.fromMeta({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "123" },
                contacts: [
                  {
                    profile: { name: "María López" },
                    wa_id: "5215512345678",
                  },
                ],
                messages: [
                  {
                    from: "5215512345678",
                    id: "wamid.1",
                    timestamp: "1717430400",
                    type: "text",
                    text: { body: "Hola, soy María" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(msg.canal).toBe("whatsapp");
    expect(msg.externalThreadId).toBe("wa:+525512345678");
    expect(msg.texto).toBe("Hola, soy María");
    expect(msg.perfilCanal).toEqual({
      nombre: "María López",
      psid: null,
      waId: "5215512345678",
    });
    expect(msg.recibidoEn).toBe(new Date(1717430400 * 1000).toISOString());
  });

  it("lee respuesta interactive y empareja el contacto del mensaje", () => {
    const [msg] = normalizer.fromMeta({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                contacts: [
                  { profile: { name: "Ana" }, wa_id: "5215500000001" },
                  { profile: { name: "Luis" }, wa_id: "5215500000002" },
                ],
                messages: [
                  {
                    from: "5215500000002",
                    id: "wamid.list",
                    timestamp: "1717430400",
                    type: "interactive",
                    interactive: {
                      type: "list_reply",
                      list_reply: { id: "ocasion.boda", title: "Boda" },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(msg.texto).toBe("Boda");
    expect(msg.buttonPayload).toBe("ocasion.boda");
    expect(msg.perfilCanal?.nombre).toBe("Luis");
    expect(msg.perfilCanal?.waId).toBe("5215500000002");
  });

  it("un webhook de statuses no produce mensajes", () => {
    const msgs = normalizer.fromMeta({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                statuses: [{ id: "wamid.x", status: "delivered" }],
              },
            },
          ],
        },
      ],
    });
    expect(msgs).toEqual([]);
  });

  it("Messenger sigue leyendo el texto y el PSID", () => {
    const [msg] = normalizer.fromMeta({
      object: "page",
      entry: [
        {
          messaging: [
            {
              sender: { id: "psid-1" },
              timestamp: 1717430400000,
              message: { mid: "m1", text: "hola" },
            },
          ],
        },
      ],
    });
    expect(msg.canal).toBe("facebook");
    expect(msg.externalThreadId).toBe("psid-1");
    expect(msg.texto).toBe("hola");
    expect(msg.perfilCanal?.waId).toBeNull();
    expect(msg.perfilCanal?.nombre).toBeNull();
  });
});
