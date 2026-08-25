import { createHmac } from "crypto";
import { verifyMetaSignature } from "../guards/meta-signature.guard";

describe("Meta X-Hub-Signature-256", () => {
  const secret = "meta-test-secret";
  const body = Buffer.from(JSON.stringify({ object: "page", entry: [] }));

  it("acepta firma válida", () => {
    const sig =
      "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyMetaSignature(body, sig, secret)).toBe(true);
  });

  it("rechaza firma inválida", () => {
    expect(verifyMetaSignature(body, "sha256=deadbeef", secret)).toBe(false);
  });

  it("rechaza header sin prefijo sha256=", () => {
    expect(verifyMetaSignature(body, "md5=abc", secret)).toBe(false);
  });
});
