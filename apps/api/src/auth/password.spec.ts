import { assertPasswordPolicy, durationToMs } from "./crypto.util";
import { hashPassword, verifyPassword } from "./password";

describe("password + crypto", () => {
  it("hash argon2id verifica y rechaza otra clave", async () => {
    const hash = await hashPassword("CorrectHorse9x");
    expect(hash.startsWith("$argon2")).toBe(true);
    expect(await verifyPassword(hash, "CorrectHorse9x")).toBe(true);
    expect(await verifyPassword(hash, "other")).toBe(false);
  });

  it("política rechaza débiles y correo embebido", () => {
    expect(() => assertPasswordPolicy("short", "ana@x.co")).toThrow();
    expect(() =>
      assertPasswordPolicy("anaesparte99A", "ana@x.co"),
    ).toThrow();
    expect(() =>
      assertPasswordPolicy("CorrectHorse9x", "ana@x.co"),
    ).not.toThrow();
  });

  it("durationToMs parsea 15m y 7d", () => {
    expect(durationToMs("15m")).toBe(900_000);
    expect(durationToMs("7d")).toBe(7 * 86_400_000);
  });
});
