import { HABLAR_ASESOR_PAYLOAD } from "@tres-cielos/shared";
import { composeWaContent } from "../wa-content.composer";

describe("composeWaContent", () => {
  it("nombre / fecha / aforo son quick-reply con hablar_asesor", () => {
    for (const paso of ["nombre", "fecha", "aforo"] as const) {
      const wa = composeWaContent({
        texto: "pregunta",
        ruta: "guion",
        pasoGuion: paso,
      });
      expect(wa?.kind).toBe("quick-reply");
      expect(wa?.templateId).toBe(`guion.${paso}`);
      expect(wa?.buttons?.some((b) => b.id === HABLAR_ASESOR_PAYLOAD)).toBe(
        true,
      );
    }
  });

  it("ocasion es list-picker con opciones y hablar_asesor", () => {
    const wa = composeWaContent({
      texto: "¿Qué tipo de evento celebran?",
      ruta: "guion",
      pasoGuion: "ocasion",
    });
    expect(wa?.kind).toBe("list-picker");
    expect(wa?.templateId).toBe("guion.ocasion");
    const ids = wa?.list?.items.map((i) => i.id) ?? [];
    expect(ids).toEqual(
      expect.arrayContaining([
        "ocasion.boda",
        "ocasion.xv",
        HABLAR_ASESOR_PAYLOAD,
      ]),
    );
  });

  it("sede residual es quick-reply solo con hablar_asesor", () => {
    const wa = composeWaContent({
      texto: "Nuestra sede es Tres Cielos Tequesquitengo.",
      ruta: "guion",
      pasoGuion: "sede",
    });
    expect(wa?.kind).toBe("quick-reply");
    expect(wa?.templateId).toBe("guion.sede");
    expect(wa?.buttons?.map((b) => b.id)).toEqual([HABLAR_ASESOR_PAYLOAD]);
  });

  it("intencion con ficha PDF adjunta conserva botones Sí/No", () => {
    const wa = composeWaContent({
      texto: "Nuestra sede es Tres Cielos Tequesquitengo. ¿Desean cotizar?",
      ruta: "guion",
      pasoGuion: "intencion",
      document: {
        filename: "Tres Cielos Paquete Bodas 2027.pdf",
        mime: "application/pdf",
        url: "http://localhost:3011/public/guion/paquete-bodas-2027.pdf",
      },
    });
    expect(wa?.kind).toBe("quick-reply");
    expect(wa?.buttons?.map((b) => b.id)).toEqual([
      "intencion.si",
      "intencion.no",
      HABLAR_ASESOR_PAYLOAD,
    ]);
    expect(wa?.document?.filename).toMatch(/Paquete Bodas 2027/);
    expect(wa?.document?.url).toMatch(/paquete-bodas-2027\.pdf$/);
  });

  it("intencion es quick-reply Sí / No / hablar_asesor", () => {
    const wa = composeWaContent({
      texto: "¿Desean cotizar?",
      ruta: "guion",
      pasoGuion: "intencion",
    });
    expect(wa?.kind).toBe("quick-reply");
    expect(wa?.buttons?.map((b) => b.id)).toEqual([
      "intencion.si",
      "intencion.no",
      HABLAR_ASESOR_PAYLOAD,
    ]);
  });

  it("faq_libre / catalogo / rag / safe incluyen hablar_asesor", () => {
    const cases = [
      { ruta: "guion", pasoGuion: "faq_libre", templateId: "guion.faq_libre" },
      { ruta: "catalogo", pasoGuion: "aforo", templateId: "canal.catalogo" },
      { ruta: "rag", pasoGuion: "faq_libre", templateId: "canal.rag" },
      { ruta: "safe", pasoGuion: "faq_libre", templateId: "canal.safe" },
    ];
    for (const c of cases) {
      const wa = composeWaContent({
        texto: "respuesta",
        ruta: c.ruta,
        pasoGuion: c.pasoGuion,
      });
      expect(wa?.kind).toBe("quick-reply");
      expect(wa?.templateId).toBe(c.templateId);
      expect(wa?.buttons?.some((b) => b.id === HABLAR_ASESOR_PAYLOAD)).toBe(
        true,
      );
    }
  });

  it("handoff es texto sin botones", () => {
    const wa = composeWaContent({
      texto: "te conecto con un asesor",
      ruta: "handoff",
      pasoGuion: "nombre",
    });
    expect(wa?.kind).toBe("text");
    expect(wa?.templateId).toBe("canal.handoff");
    expect(wa?.buttons).toBeUndefined();
    expect(wa?.list).toBeUndefined();
  });

  it("silencio o body vacío no produce contenido", () => {
    expect(
      composeWaContent({ texto: "", ruta: "guion", pasoGuion: "nombre" }),
    ).toBeUndefined();
    expect(
      composeWaContent({
        texto: "hola",
        ruta: "silencio",
        pasoGuion: "nombre",
      }),
    ).toBeUndefined();
  });
});
