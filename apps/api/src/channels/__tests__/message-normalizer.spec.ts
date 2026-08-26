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
