import { ScriptService } from "./script.service";
import type { ConversacionState } from "../types";

function baseConv(overrides?: Partial<ConversacionState>): ConversacionState {
  return {
    id: "c1",
    canal: "whatsapp",
    externalThreadId: "t1",
    estadoBot: "activo",
    pasoGuion: "saludo",
    camposCapturados: {},
    paqueteTentativoId: null,
    ultimaRuta: null,
    motivoHandoff: null,
    escaladoEn: null,
    oportunidadId: "o1",
    brief: {},
    calificado: false,
    listoParaCotizar: false,
    mensajes: [],
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
    ...overrides,
  };
}

describe("ScriptService (B2)", () => {
  const script = new ScriptService();

  it("saludo → pide nombre sin RAG", async () => {
    const r = await script.handleTurn(baseConv(), "Hola");
    expect(r.pasoGuion).toBe("nombre");
    expect(r.textoRespuesta).toMatch(/nombre/i);
  });

  it("saludo con nombre en el mismo mensaje avanza a ocasion", async () => {
    const r = await script.handleTurn(baseConv(), "ola k tal soy paty");
    expect(r.pasoGuion).toBe("ocasion");
    expect(r.camposCapturados.nombre?.toLowerCase()).toBe("paty");
  });

  it("captura aforo inválido no avanza", async () => {
    const r = await script.handleTurn(
      baseConv({
        pasoGuion: "aforo",
        camposCapturados: { nombre: "Ana", tipoEvento: "boda" },
      }),
      "muchos",
    );
    expect(r.pasoGuion).toBe("aforo");
  });

  it("rechaza 120 px y 120px con aviso", async () => {
    const px = await script.handleTurn(
      baseConv({
        pasoGuion: "aforo",
        camposCapturados: { nombre: "Ana", tipoEvento: "boda" },
      }),
      "120 px",
    );
    expect(px.pasoGuion).toBe("aforo");
    expect(px.camposCapturados.aforo).toBeUndefined();
    expect(px.textoRespuesta).toMatch(/120 px/i);
    expect(px.textoRespuesta).toMatch(/no puedo procesar/i);

    const pegado = await script.handleTurn(
      baseConv({
        pasoGuion: "aforo",
        camposCapturados: { nombre: "Ana", tipoEvento: "boda" },
      }),
      "120px",
    );
    expect(pegado.pasoGuion).toBe("aforo");
    expect(pegado.textoRespuesta).toMatch(/120px/i);
  });

  it("acepta 120, 120 pax y 120 personas", async () => {
    for (const texto of ["120", "120 pax", "120 personas"]) {
      const r = await script.handleTurn(
        baseConv({
          pasoGuion: "aforo",
          camposCapturados: {
            nombre: "Ana",
            tipoEvento: "boda",
            fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
          },
        }),
        texto,
      );
      expect(r.pasoGuion).toBe("intencion");
      expect(r.camposCapturados.aforo).toBe(120);
      expect(r.camposCapturados.sedeNombre).toBe("Tres Cielos Tequesquitengo");
      expect(r.camposCapturados.sedeId).toBe("sede-tequesquitengo");
      expect(r.adjuntoGuion).toBe("paquete-bodas-2027");
      expect(r.textoRespuesta).toMatch(/Tres Cielos Tequesquitengo/);
      expect(r.textoRespuesta).toMatch(/cotizar/i);
    }
  });

  it("tap ocasion.boda (texto canónico) avanza a fecha", async () => {
    const r = await script.handleTurn(
      baseConv({
        pasoGuion: "ocasion",
        camposCapturados: { nombre: "Ana" },
      }),
      "boda",
    );
    expect(r.pasoGuion).toBe("fecha");
    expect(r.camposCapturados.tipoEvento).toBe("boda");
    expect(r.textoRespuesta).not.toMatch(/boda, xv/i);
  });

  it("flujo mínimo hasta faq_libre sin presupuesto", async () => {
    let conv = baseConv();
    const steps: Array<{ texto: string }> = [
      { texto: "Hola" },
      { texto: "Ana Ruiz" },
      { texto: "boda" },
      { texto: "2026-11-14" },
      { texto: "150" },
      { texto: "sí" },
    ];
    for (const s of steps) {
      const r = await script.handleTurn(conv, s.texto);
      conv = {
        ...conv,
        pasoGuion: r.pasoGuion,
        camposCapturados: r.camposCapturados,
      };
    }
    expect(conv.pasoGuion).toBe("faq_libre");
    expect(script.isCompleto(conv.camposCapturados)).toBe(true);
    expect(conv.camposCapturados.sedeNombre).toBe("Tres Cielos Tequesquitengo");
    expect(conv.camposCapturados.sedeId).toBe("sede-tequesquitengo");
    expect(conv.camposCapturados.presupuestoOrientativo).toBeUndefined();
  });

  it("hilo en paso sede autosigna Tequesquitengo y pasa a intención con PDF", async () => {
    const r = await script.handleTurn(
      baseConv({
        pasoGuion: "sede",
        camposCapturados: { nombre: "Ana", tipoEvento: "boda", aforo: 120 },
      }),
      "ok",
    );
    expect(r.pasoGuion).toBe("intencion");
    expect(r.camposCapturados.sedeNombre).toBe("Tres Cielos Tequesquitengo");
    expect(r.camposCapturados.sedeId).toBe("sede-tequesquitengo");
    expect(r.adjuntoGuion).toBe("paquete-bodas-2027");
    expect(r.textoRespuesta).toMatch(/Tequesquitengo/);
    expect(r.textoRespuesta).toMatch(/cotizar/i);
    expect(r.textoRespuesta).not.toMatch(/presupuesto/i);
    expect(r.textoRespuesta).not.toMatch(/sí \/ no/i);
  });

  it("paso presupuesto legado se trata como intención", async () => {
    const r = await script.handleTurn(
      baseConv({
        pasoGuion: "presupuesto",
        camposCapturados: {
          nombre: "Paty",
          tipoEvento: "boda",
          fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
          aforo: 120,
        },
      }),
      "sí",
    );
    expect(r.pasoGuion).toBe("faq_libre");
    expect(r.camposCapturados.intencionCotizar).toBe(true);
  });

  it("fecha sin año no avanza y pide el año", async () => {
    const r = await script.handleTurn(
      baseConv({
        pasoGuion: "fecha",
        camposCapturados: { nombre: "Ana", tipoEvento: "boda" },
      }),
      "22 de diciembre",
    );
    expect(r.pasoGuion).toBe("fecha");
    expect(r.textoRespuesta).toMatch(/año/i);
    expect(r.textoRespuesta).toMatch(/22 de diciembre de 2027/);
    expect(r.textoRespuesta).not.toMatch(/2026/);
    expect(r.camposCapturados.fechaTentativa).toBeUndefined();
  });

  it("interpreta fecha coloquial con año y typos léxicos sin LLM", async () => {
    const fecha = await script.handleTurn(
      baseConv({
        pasoGuion: "fecha",
        camposCapturados: { nombre: "Ana", tipoEvento: "boda" },
      }),
      "el 15 de marzo de 2027 masomenos",
    );
    expect(fecha.pasoGuion).toBe("aforo");
    expect(fecha.camposCapturados.fechaTentativa?.tipo).toBe("dia");
    expect(fecha.camposCapturados.fechaTentativa?.flexible).toBe(true);

    const nombre = await script.handleTurn(
      baseConv({ pasoGuion: "nombre" }),
      "ola k tal soy paty",
    );
    expect(nombre.camposCapturados.nombre?.toLowerCase()).toBe("paty");

    const tipo = await script.handleTurn(
      baseConv({
        pasoGuion: "ocasion",
        camposCapturados: { nombre: "Paty" },
      }),
      "es una voda",
    );
    expect(tipo.camposCapturados.tipoEvento).toBe("boda");

    const si = await script.handleTurn(
      baseConv({ pasoGuion: "intencion" }),
      "sip",
    );
    expect(si.camposCapturados.intencionCotizar).toBe(true);
  });

  it("en live usa LLM si el extractor léxico falla", async () => {
    const llm = {
      complete: jest.fn(async () => ({
        content: JSON.stringify({ confianza: 0.92, tipoEvento: "boda" }),
        model: "test",
      })),
      completeWithTools: jest.fn(),
    };
    const config = {
      get: (k: string) => (k === "ai.providersMode" ? "live" : undefined),
    };
    const live = new ScriptService(llm as never, config as never);
    const r = await live.handleTurn(
      baseConv({
        pasoGuion: "ocasion",
        camposCapturados: { nombre: "Ana" },
      }),
      "xyzzy evento raro",
    );
    expect(r.pasoGuion).toBe("fecha");
    expect(r.camposCapturados.tipoEvento).toBe("boda");
    expect(llm.complete).toHaveBeenCalled();
  });

  it("en live no usa LLM para inventar año ni aforo px", async () => {
    const llm = {
      complete: jest.fn(async () => ({
        content: JSON.stringify({
          confianza: 0.95,
          fechaTentativa: { tipo: "dia", fecha: "2026-12-22" },
          aforo: 120,
        }),
        model: "test",
      })),
      completeWithTools: jest.fn(),
    };
    const config = {
      get: (k: string) => (k === "ai.providersMode" ? "live" : undefined),
    };
    const live = new ScriptService(llm as never, config as never);

    const fecha = await live.handleTurn(
      baseConv({
        pasoGuion: "fecha",
        camposCapturados: { nombre: "Ana", tipoEvento: "boda" },
      }),
      "22 de diciembre",
    );
    expect(fecha.pasoGuion).toBe("fecha");
    expect(llm.complete).not.toHaveBeenCalled();

    const aforo = await live.handleTurn(
      baseConv({
        pasoGuion: "aforo",
        camposCapturados: { nombre: "Ana", tipoEvento: "boda" },
      }),
      "120 px",
    );
    expect(aforo.pasoGuion).toBe("aforo");
    expect(aforo.camposCapturados.aforo).toBeUndefined();
  });

  it("primer mensaje rico salta ocasión/fecha/aforo y pide nombre", async () => {
    const r = await script.handleTurn(
      baseConv(),
      "Necesito que me ayudes con una cotización para una boda el 22 de diciembre del 2027 para 150 invitados",
    );
    expect(r.pasoGuion).toBe("nombre");
    expect(r.camposCapturados.tipoEvento).toBe("boda");
    expect(r.camposCapturados.fechaTentativa?.fecha).toBe("2027-12-22");
    expect(r.camposCapturados.aforo).toBe(150);
    expect(r.camposCapturados.intencionCotizar).toBe(true);
    expect(r.textoRespuesta).toMatch(/registré/i);
    expect(r.textoRespuesta).toMatch(/nombre/i);
    expect(r.textoRespuesta).not.toMatch(/tipo de evento/i);
  });

  it("saludo con nombre de perfil y boda+fecha+aforo no pregunta ocasión", async () => {
    const r = await script.handleTurn(
      baseConv({ camposCapturados: { nombre: "Ana" } }),
      "boda el 22 de diciembre del 2027 para 150 invitados",
    );
    expect(r.camposCapturados.tipoEvento).toBe("boda");
    expect(r.camposCapturados.aforo).toBe(150);
    expect(r.pasoGuion).not.toBe("ocasion");
    expect(r.textoRespuesta).not.toMatch(/tipo de evento/i);
  });

  it("Si estoy interesado en saludo no se guarda como nombre", async () => {
    const r = await script.handleTurn(baseConv(), "Si estoy interesado");
    expect(r.camposCapturados.nombre).toBeFalsy();
    expect(r.camposCapturados.intencionCotizar).toBe(true);
    expect(r.textoRespuesta).not.toMatch(/Gracias, Si estoy interesado/i);
    expect(r.pasoGuion).toBe("nombre");
  });

  it("Quiero reservar en saludo pide nombre y no lo registra como persona", async () => {
    const r = await script.handleTurn(baseConv(), "Quiero reservar");
    expect(r.camposCapturados.nombre).toBeFalsy();
    expect(r.pasoGuion).toBe("nombre");
    expect(r.textoRespuesta).toMatch(/nombre/i);
    expect(r.textoRespuesta).not.toMatch(/Gracias, Quiero reservar/i);
  });
});
