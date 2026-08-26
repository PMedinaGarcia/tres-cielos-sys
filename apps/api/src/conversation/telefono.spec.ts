import {
  phoneFingerprint,
  phoneMatchVariants,
  normalizeTelefono,
} from "../conversation/telefono";

describe("phoneFingerprint MX", () => {
  it("unifica +52, +521 y local a 10 dígitos", () => {
    expect(phoneFingerprint("+5215512345678")).toBe("5512345678");
    expect(phoneFingerprint("whatsapp:+525512345678")).toBe("5512345678");
    expect(phoneFingerprint("wa:+5215512345678")).toBe("5512345678");
    expect(phoneFingerprint("5512345678")).toBe("5512345678");
    expect(phoneFingerprint("5215512345678")).toBe("5512345678");
    expect(phoneFingerprint("sandbox-web")).toBeNull();
  });

  it("normalizeTelefono canónico +52 + 10 dígitos", () => {
    expect(normalizeTelefono("+5215512345678")).toBe("+525512345678");
    expect(normalizeTelefono("55 1234 5678")).toBe("+525512345678");
  });

  it("variantes de búsqueda cubren formatos viejos", () => {
    const v = phoneMatchVariants("5512345678");
    expect(v).toEqual(
      expect.arrayContaining([
        "5512345678",
        "+525512345678",
        "+5215512345678",
        "525512345678",
        "5215512345678",
      ]),
    );
  });
});
