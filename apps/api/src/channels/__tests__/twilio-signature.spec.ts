import { createHmac } from "crypto";
import { verifyTwilioSignature } from "../guards/twilio-signature.guard";

describe("Twilio signature", () => {
  const token = "twilio-auth-token";
  const url = "https://example.com/webhooks/twilio/whatsapp";
  const params = {
    From: "whatsapp:+5215512345678",
    Body: "Hola",
    MessageSid: "SMabc123",
  };

  function sign(): string {
    const data =
      url +
      Object.keys(params)
        .sort()
        .map((k) => k + params[k as keyof typeof params])
        .join("");
    return createHmac("sha1", token).update(data, "utf8").digest("base64");
  }

  it("acepta firma válida", () => {
    expect(verifyTwilioSignature(url, params, sign(), token)).toBe(true);
  });

  it("rechaza firma inválida", () => {
    expect(
      verifyTwilioSignature(url, params, "not-a-valid-sig====", token),
    ).toBe(false);
  });
});
