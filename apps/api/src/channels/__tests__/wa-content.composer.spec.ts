import { composeWaContent } from "../wa-content.composer";

describe("composeWaContent", () => {
  it("nombre / fecha / aforo son texto sin hablar_asesor en la burbuja", () => {
    for (const paso of ["nombre", "fecha", "aforo"] as const) {
      const wa = composeWaContent({
        texto: "pregunta",
        ruta: "guion",
        pasoGuion: paso,
      });
      expect(wa?.kind).toBe("text");
      expect(wa?.templateId).toBe(`guion.${paso}`);
      expect(wa?.buttons).toBeUndefined();
    }
  });

  it("ocasion es list-picker sin hablar_asesor", () => {
    const wa = composeWaContent({
      texto: "¿Qué tipo de evento celebran?",
      ruta: "guion",
      pasoGuion: "ocasion",
    });
    expect(wa?.kind).toBe("list-picker");
    expect(wa?.templateId).toBe("guion.ocasion");
    const ids = wa?.list?.items.map((i) => i.id) ?? [];
    expect(ids).toEqual(
      expect.arrayContaining(["ocasion.boda", "ocasion.xv"]),
    );
    expect(ids).not.toContain("hablar_asesor");
  });

  it("sede residual es texto", () => {
    const wa = composeWaContent({
      texto: "Nuestra sede es Tres Cielos Tequesquitengo.",
      ruta: "guion",
      pasoGuion: "sede",
    });
    expect(wa?.kind).toBe("text");
    expect(wa?.templateId).toBe("guion.sede");
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
    ]);
    expect(wa?.document?.filename).toMatch(/Paquete Bodas 2027/);
    expect(wa?.document?.url).toMatch(/paquete-bodas-2027\.pdf$/);
  });

  it("intencion es quick-reply Sí / No", () => {
    const wa = composeWaContent({
      texto: "¿Desean cotizar?",
      ruta: "guion",
      pasoGuion: "intencion",
    });
    expect(wa?.kind).toBe("quick-reply");
    expect(wa?.buttons?.map((b) => b.id)).toEqual([
      "intencion.si",
      "intencion.no",
    ]);
  });

  it("faq_libre / catalogo / rag / safe son texto", () => {
    const cases = [
      { ruta: "guion", pasoGuion: "faq_libre", templateId: "guion.faq_libre" },
      { ruta: "catalogo", pasoGuion: "aforo", templateId: "canal.catalogo" },
      { ruta: "rag", pasoGuion: "faq_libre", templateId: "canal.rag" },
      { ruta: "safe", pasoGuion: "nombre", templateId: "canal.safe" },
    ];
    for (const c of cases) {
      const wa = composeWaContent({
        texto: "respuesta",
        ruta: c.ruta,
        pasoGuion: c.pasoGuion,
      });
      expect(wa?.kind).toBe("text");
      expect(wa?.templateId).toBe(c.templateId);
      expect(wa?.buttons).toBeUndefined();
    }
  });

  it("cierre de nutrición es texto sin botones de cotización", () => {
    const wa = composeWaContent({
      texto: "Conservamos tu solicitud",
      ruta: "safe",
      pasoGuion: "faq_libre",
    });
    expect(wa?.kind).toBe("text");
    expect(wa?.templateId).toBe("canal.nutricion");
    expect(wa?.buttons).toBeUndefined();
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

  it("v2 nombre_fecha es texto; aforo_inversion pide aforo en texto y rango en list-picker", () => {
    const b1 = composeWaContent({
      texto: "¿nombre y fecha?",
      ruta: "guion",
      pasoGuion: "nombre_fecha",
    });
    expect(b1?.kind).toBe("text");
    expect(b1?.templateId).toBe("guion.nombre_fecha");
    const b2Aforo = composeWaContent({
      texto: "¿Para cuántas personas sería aproximadamente?",
      ruta: "guion",
      pasoGuion: "aforo_inversion",
    });
    expect(b2Aforo?.kind).toBe("text");
    expect(b2Aforo?.templateId).toBe("guion.aforo");
    const b2 = composeWaContent({
      texto: "inversión",
      ruta: "guion",
      pasoGuion: "aforo_inversion",
      aforo: 150,
    });
    expect(b2?.kind).toBe("list-picker");
    expect(b2?.list?.items.map((i) => i.id)).toEqual(
      expect.arrayContaining([
        "inversion.r250_349",
        "inversion.por_definir",
      ]),
    );
    expect(b2?.list?.items.map((i) => i.id)).not.toContain("hablar_asesor");
    const b3 = composeWaContent({
      texto: "¿Se sentirían cómodos con 250,000?",
      ruta: "guion",
      pasoGuion: "aclaracion_piso",
    });
    expect(b3?.kind).toBe("quick-reply");
    expect(b3?.buttons?.map((b) => b.id)).toEqual([
      "aclaracion.si",
      "aclaracion.no",
    ]);
    expect(b3?.buttons?.map((b) => b.title)).toEqual([
      "Sí, lo consideramos",
      "Buscamos algo menor",
    ]);
    for (const title of b3?.buttons?.map((b) => b.title) ?? []) {
      expect(title.length).toBeLessThanOrEqual(20);
    }
  });
});
