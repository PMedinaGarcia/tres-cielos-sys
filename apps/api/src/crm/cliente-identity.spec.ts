import {
  identifiersFromThread,
  mapCanalCrm,
  mapEstadoAtencion,
  normalizeIdentificador,
} from "./cliente-identity";

describe("cliente-identity", () => {
  it("normaliza teléfono y wa_id con huella de 10 dígitos", () => {
    expect(normalizeIdentificador("telefono", "whatsapp:+5215512345678")).toEqual({
      tipo: "telefono",
      valor: "+525512345678",
      valorNormalizado: "5512345678",
    });
    expect(normalizeIdentificador("email", "  Ana@Tres.mx ")).toEqual({
      tipo: "email",
      valor: "ana@tres.mx",
      valorNormalizado: "ana@tres.mx",
    });
    expect(normalizeIdentificador("email", "nolemail")).toBeNull();
  });

  it("WhatsApp produce wa_id + telefono, no PSID", () => {
    const ids = identifiersFromThread({
      canal: "whatsapp",
      externalThreadId: "wa:+5215512345678",
    });
    expect(ids.map((i) => i.tipo).sort()).toEqual(["telefono", "wa_id"]);
    expect(ids.every((i) => i.valorNormalizado === "5512345678")).toBe(
      true,
    );
  });

  it("Facebook e Instagram no se fusionan con WhatsApp", () => {
    const fb = identifiersFromThread({
      canal: "facebook",
      externalThreadId: "psid-abc",
    });
    const ig = identifiersFromThread({
      canal: "instagram",
      externalThreadId: "psid-abc",
    });
    const wa = identifiersFromThread({
      canal: "whatsapp",
      externalThreadId: "wa:+5215512345678",
    });
    expect(fb).toEqual([
      {
        tipo: "meta_psid",
        valor: "psid-abc",
        valorNormalizado: "psid-abc",
      },
    ]);
    expect(ig[0]?.tipo).toBe("ig_scoped_id");
    const keys = (xs: typeof wa) =>
      new Set(xs.map((i) => `${i.tipo}:${i.valorNormalizado}`));
    const overlap = [...keys(fb)].filter((k) => keys(wa).has(k));
    expect(overlap).toEqual([]);
  });

  it("mapea estadoBot → estadoAtencion", () => {
    expect(mapEstadoAtencion("activo")).toBe("bot_activo");
    expect(mapEstadoAtencion("escalado")).toBe("escalado");
    expect(mapEstadoAtencion("humano")).toBe("en_atencion");
    expect(mapCanalCrm("messenger")).toBe("facebook");
  });

  it("toma el wa_id del perfil y el correo del guion", () => {
    const ids = identifiersFromThread({
      canal: "whatsapp",
      externalThreadId: "wa:+525512345678",
      perfil: { nombre: "Ana", waId: "5215512345678" },
      campos: { email: "Ana@Tres.mx" },
    });
    expect(ids.map((i) => i.tipo).sort()).toEqual(["email", "telefono", "wa_id"]);
    expect(ids.find((i) => i.tipo === "email")?.valor).toBe("ana@tres.mx");
  });

  it("sandbox con teléfono en el hilo también produce identificador telefono", () => {
    const ids = identifiersFromThread({
      canal: "web",
      externalThreadId: "wa:+5215512345678",
    });
    expect(ids.some((i) => i.tipo === "sandbox_thread")).toBe(true);
    expect(ids.some((i) => i.tipo === "telefono" && i.valorNormalizado === "5512345678")).toBe(
      true,
    );
  });
});
