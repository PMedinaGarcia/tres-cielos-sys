import {
  composePedidoCatalogoFromCampos,
  evaluarPedidoCotizacion,
  extractNombre,
  harvestCamposLexical,
  isPerfilListo,
  isRecotizarPorSlots,
  looksLikePersonName,
  nextPasoGuion,
  parseAforo,
  parseCtaGuion,
} from "./harvest-campos";
import type { CamposCapturados } from "../types";

const FRASE_SANDBOX =
  "Necesito que me ayudes con una cotización para una boda el 22 de diciembre del 2027 para 150 invitados";

const NOW = new Date("2026-08-27T18:00:00.000Z");

describe("harvestCamposLexical", () => {
  it("extrae tipo, fecha día y aforo de la frase completa del sandbox", () => {
    const r = harvestCamposLexical(FRASE_SANDBOX, {}, { now: NOW });
    expect(r.campos.tipoEvento).toBe("boda");
    expect(r.campos.fechaTentativa).toEqual({
      tipo: "dia",
      fecha: "2027-12-22",
      flexible: false,
    });
    expect(r.campos.aforo).toBe(150);
    expect(r.campos.intencionCotizar).toBe(true);
    expect(r.campos.nombre).toBeFalsy();
    expect(r.campos.sedeId).toBe("sede-tequesquitengo");
    expect(nextPasoGuion(r.campos)).toBe("nombre");
  });

  it("payload fecha.* y su título llenan la ventana con foco fecha_ventana o nombre_fecha", () => {
    const porId = harvestCamposLexical("fecha.oct_dic", {}, {
      now: NOW,
      focusedPaso: "fecha_ventana",
    });
    expect(porId.campos.fechaTentativa).toMatchObject({
      tipo: "rango",
      desde: "2027-10-01",
      hasta: "2027-12-31",
    });
    const porTitulo = harvestCamposLexical("Ene-May", {}, {
      now: NOW,
      focusedPaso: "fecha_ventana",
    });
    expect(porTitulo.filled).toContain("fechaTentativa");
    expect(porTitulo.campos.fechaTentativa).toMatchObject({
      desde: "2027-01-01",
      hasta: "2027-05-31",
    });
    const porListaNombreFecha = harvestCamposLexical("Jun-Sep", {}, {
      now: NOW,
      focusedPaso: "nombre_fecha",
    });
    expect(porListaNombreFecha.filled).toContain("fechaTentativa");
    expect(porListaNombreFecha.campos.fechaTentativa).toMatchObject({
      desde: "2027-06-01",
      hasta: "2027-09-30",
    });
    expect(porListaNombreFecha.campos.nombre).toBeFalsy();
    const eneMayNombreFecha = harvestCamposLexical("Ene-May", {}, {
      now: NOW,
      focusedPaso: "nombre_fecha",
    });
    expect(eneMayNombreFecha.campos.fechaTentativa).toBeTruthy();
    expect(eneMayNombreFecha.campos.nombre).toBeFalsy();
    for (const titulo of ["Ene-May 2027", "Ene a May 2027"]) {
      const conAnio = harvestCamposLexical(titulo, {}, {
        now: NOW,
        focusedPaso: "fecha_ventana",
      });
      expect(conAnio.campos.fechaTentativa).toMatchObject({
        desde: "2027-01-01",
        hasta: "2027-05-31",
      });
      expect(conAnio.campos.nombre).toBeFalsy();
    }
    const octDic = harvestCamposLexical("Oct-Dic 2027", {}, {
      now: NOW,
      focusedPaso: "fecha_ventana",
    });
    expect(octDic.campos.fechaTentativa).toMatchObject({
      desde: "2027-10-01",
      hasta: "2027-12-31",
    });
    const sinFoco = harvestCamposLexical("2028", {}, { now: NOW });
    expect(sinFoco.campos.fechaTentativa).toBeFalsy();
  });

  it("diciembre 2027 es ventana y unas 150 llena aforo", () => {
    const r = harvestCamposLexical("Soy Ana, diciembre 2027, unas 150", {}, { now: NOW });
    expect(r.campos.fechaTentativa?.tipo).toBe("mes");
    expect(r.campos.fechaEstado).toBe("ventana");
    expect(r.campos.aforo).toBe(150);
  });

  it("Es en Febrero 2027 con foco nombre_fecha llena ventana sin nombre", () => {
    const r = harvestCamposLexical("Es en Febrero 2027", {}, {
      now: NOW,
      focusedPaso: "nombre_fecha",
    });
    expect(r.campos.fechaTentativa).toEqual({
      tipo: "mes",
      mes: 2,
      anio: 2027,
      flexible: true,
    });
    expect(r.campos.fechaEstado).toBe("ventana");
    expect(r.filled).toContain("fechaTentativa");
    expect(r.campos.nombre).toBeFalsy();
  });

  it("febrero 27 con foco nombre_fecha es ventana 2027", () => {
    const r = harvestCamposLexical("febrero 27", {}, {
      now: NOW,
      focusedPaso: "nombre_fecha",
    });
    expect(r.campos.fechaTentativa).toEqual({
      tipo: "mes",
      mes: 2,
      anio: 2027,
      flexible: true,
    });
    expect(r.campos.fechaEstado).toBe("ventana");
    expect(r.filled).toContain("fechaTentativa");
  });

  it("un mensaje puede llenar nombre, fecha, aforo y rango", () => {
    const r = harvestCamposLexical(
      "Soy Ana Ruiz, cotización para una boda el 22 de diciembre del 2027 para 150 invitados, presupuesto 350 mil",
      {},
      { now: NOW },
    );
    expect(r.campos.nombre?.toLowerCase()).toContain("ana");
    expect(r.campos.aforo).toBe(150);
    expect(r.campos.rangoInversion).toBe("r350_499");
    expect(r.campos.encajeEconomico).toBe("confirmado");
    expect(r.campos.intencionNivel).toBe("alta");
  });

  it("otro día no infiere tipo de evento otro", () => {
    const r = harvestCamposLexical("el otro día vimos el jardín", {
      tipoEvento: "boda",
    });
    expect(r.campos.tipoEvento).toBe("boda");
    expect(harvestCamposLexical("el otro día", {}).campos.tipoEvento).toBeUndefined();
  });

  it("Si estoy interesado marca intención y no es un nombre", () => {
    const r = harvestCamposLexical("Si estoy interesado", {});
    expect(r.campos.intencionCotizar).toBe(true);
    expect(r.campos.nombre).toBeFalsy();
    expect(extractNombre("Si estoy interesado")).toBeNull();
  });

  it("no pisa un nombre ya capturado con una frase de interés", () => {
    const prev: CamposCapturados = { nombre: "Ana" };
    const r = harvestCamposLexical("Si estoy interesado", prev);
    expect(r.campos.nombre).toBe("Ana");
    expect(r.campos.intencionCotizar).toBe(true);
    expect(r.filled).not.toContain("nombre");
  });

  it("en harvest no toma el día del mes como aforo", () => {
    const r = harvestCamposLexical(
      "boda el 22 de diciembre del 2027 para 150 invitados",
      {},
      { now: NOW },
    );
    expect(r.campos.aforo).toBe(150);
    expect(parseAforo("el 22 de diciembre del 2027 para 150 invitados", { modo: "harvest" })).toEqual({
      ok: true,
      aforo: 150,
    });
  });

  it("en paso aforo acepta un entero suelto", () => {
    const r = harvestCamposLexical("150", {}, { focusedPaso: "aforo" });
    expect(r.campos.aforo).toBe(150);
    expect(parseAforo("150", { modo: "paso" })).toEqual({ ok: true, aforo: 150 });
  });

  it("payload de inversión no se interpreta como aforo 250", () => {
    const r = harvestCamposLexical("inversion.r250_349", {}, {
      focusedPaso: "aforo_inversion",
    });
    expect(r.campos.aforo).toBeUndefined();
    expect(r.campos.rangoInversion).toBe("r250_349");
    const rango = harvestCamposLexical("$250–349 mil", { aforo: 150 }, {
      focusedPaso: "aforo_inversion",
    });
    expect(rango.campos.aforo).toBe(150);
    expect(rango.campos.rangoInversion).toBe("r250_349");
  });

  it("captura día aunque falte de entre número y mes", () => {
    const r = harvestCamposLexical(
      "Hola quiero cotizar una boda para el 22 Diciembre del 2026",
      {},
      { now: NOW },
    );
    expect(r.campos.tipoEvento).toBe("boda");
    expect(r.campos.fechaTentativa).toEqual({
      tipo: "dia",
      fecha: "2026-12-22",
      flexible: false,
    });
  });

  it("upgrade mes a día y reemplaza fecha si el lead corrige el año", () => {
    const mes: CamposCapturados = {
      fechaTentativa: { tipo: "mes", mes: 12, anio: 2026, flexible: true },
    };
    const upgraded = harvestCamposLexical(
      "22 Diciembre del 2026",
      mes,
      { now: NOW },
    );
    expect(upgraded.campos.fechaTentativa).toEqual({
      tipo: "dia",
      fecha: "2026-12-22",
      flexible: false,
    });
    expect(upgraded.filled).toContain("fechaTentativa");

    const replaced = harvestCamposLexical(
      "Para 22 Diciembre del 2027",
      { fechaTentativa: { tipo: "dia", fecha: "2026-12-22", flexible: false } },
      { now: NOW, focusedPaso: "faq_libre" },
    );
    expect(replaced.campos.fechaTentativa).toEqual({
      tipo: "dia",
      fecha: "2027-12-22",
      flexible: false,
    });
    expect(replaced.campos.aforo).toBeUndefined();
  });

  it("en faq_libre corrige aforo con unidad o para N, no el día de una fecha", () => {
    const prev: CamposCapturados = { aforo: 150 };
    const replaced = harvestCamposLexical("ahora para 200 invitados", prev, {
      now: NOW,
      focusedPaso: "faq_libre",
    });
    expect(replaced.campos.aforo).toBe(200);
    expect(replaced.filled).toContain("aforo");

    const fecha = harvestCamposLexical(
      "Para el 22 de Enero de 2027 entonces",
      prev,
      { now: NOW, focusedPaso: "faq_libre" },
    );
    expect(fecha.campos.aforo).toBe(150);
    expect(fecha.filled).not.toContain("aforo");
  });

  it("isRecotizarPorSlots solo en faq_libre con perfil e intención", () => {
    expect(
      isRecotizarPorSlots({
        pasoGuion: "faq_libre",
        perfilListo: true,
        intencionCotizar: true,
        filled: ["fechaTentativa"],
      }),
    ).toBe(true);
    expect(
      isRecotizarPorSlots({
        pasoGuion: "faq_libre",
        perfilListo: true,
        intencionCotizar: true,
        filled: ["aforo"],
      }),
    ).toBe(true);
    expect(
      isRecotizarPorSlots({
        pasoGuion: "faq_libre",
        perfilListo: true,
        intencionCotizar: true,
        filled: ["nombre"],
      }),
    ).toBe(false);
    expect(
      isRecotizarPorSlots({
        pasoGuion: "fecha",
        perfilListo: true,
        intencionCotizar: true,
        filled: ["fechaTentativa"],
      }),
    ).toBe(false);
    expect(
      isRecotizarPorSlots({
        pasoGuion: "faq_libre",
        perfilListo: true,
        intencionCotizar: false,
        filled: ["fechaTentativa"],
      }),
    ).toBe(false);
  });

  it("Quiero reservar no es un nombre y el siguiente paso sigue siendo nombre", () => {
    const r = harvestCamposLexical("Quiero reservar", {});
    expect(r.campos.nombre).toBeFalsy();
    expect(nextPasoGuion(r.campos)).toBe("nombre");
    expect(extractNombre("Quiero reservar")).toBeNull();
  });

  it("limpia un nombre inválido ya guardado", () => {
    const r = harvestCamposLexical("ok", {
      nombre: "Quiero reservar",
    });
    expect(r.campos.nombre).toBeFalsy();
    expect(nextPasoGuion(r.campos)).toBe("nombre");
  });
});

describe("extractNombre / looksLikePersonName", () => {
  it("acepta nombres de persona", () => {
    expect(extractNombre("Patricio Medina")).toBe("Patricio Medina");
    expect(extractNombre("Paty", { focusedPaso: "nombre" })).toBe("Paty");
    expect(extractNombre("me llamo Ana")).toBe("Ana");
    expect(extractNombre("me llamo Patricio y quiero reservar")).toBe(
      "Patricio",
    );
    expect(looksLikePersonName("María de los Ángeles")).toBe(true);
    expect(looksLikePersonName("Patricio Medina")).toBe(true);
    expect(looksLikePersonName("Paty")).toBe(true);
  });

  it("rechaza frases que no son un nombre", () => {
    expect(extractNombre("Quiero reservar")).toBeNull();
    expect(extractNombre("Buenos días")).toBeNull();
    expect(extractNombre("15 de diciembre")).toBeNull();
    expect(looksLikePersonName("Quiero reservar")).toBe(false);
    expect(extractNombre("Paty", { focusedPaso: "fecha" })).toBeNull();
  });
});

const PERFIL_LISTO: CamposCapturados = {
  nombre: "Paty",
  tipoEvento: "boda",
  fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
  aforo: 150,
  sedeId: "sede-tequesquitengo",
  sedeNombre: "Tres Cielos Tequesquitengo",
  intencionCotizar: true,
};

describe("evaluarPedidoCotizacion", () => {
  it("no es evaluable sin perfil listo (falta nombre)", () => {
    const harvested = harvestCamposLexical(FRASE_SANDBOX, {}, { now: NOW });
    expect(isPerfilListo(harvested.campos)).toBe(false);
    expect(
      evaluarPedidoCotizacion({
        texto: FRASE_SANDBOX,
        pasoGuion: "saludo",
        campos: harvested.campos,
      }),
    ).toEqual({ evaluable: false, pedido: null, fuente: null });
  });

  it("texto monetario en faq_libre → pedido texto_monetario", () => {
    expect(
      evaluarPedidoCotizacion({
        texto: "Qué precios manejan",
        pasoGuion: "faq_libre",
        campos: PERFIL_LISTO,
      }),
    ).toEqual({
      evaluable: true,
      pedido: true,
      fuente: "texto_monetario",
    });
  });

  it("nombre tras cotización rica → intencion_previa", () => {
    expect(
      evaluarPedidoCotizacion({
        texto: "Paty",
        pasoGuion: "nombre",
        campos: PERFIL_LISTO,
      }),
    ).toEqual({
      evaluable: true,
      pedido: true,
      fuente: "intencion_previa",
    });
  });

  it("sí en paso intencion → afirmacion_stage", () => {
    expect(
      evaluarPedidoCotizacion({
        texto: "sí",
        pasoGuion: "intencion",
        campos: { ...PERFIL_LISTO, intencionCotizar: true },
      }),
    ).toEqual({
      evaluable: true,
      pedido: true,
      fuente: "afirmacion_stage",
    });
  });

  it("no en paso intencion → rechazo", () => {
    expect(
      evaluarPedidoCotizacion({
        texto: "no",
        pasoGuion: "intencion",
        campos: { ...PERFIL_LISTO, intencionCotizar: false },
      }),
    ).toEqual({
      evaluable: true,
      pedido: false,
      fuente: "rechazo",
    });
  });

  it("pregunta de venue en faq_libre no reusa intencion_previa", () => {
    expect(
      evaluarPedidoCotizacion({
        texto: "cómo llego al jardín",
        pasoGuion: "faq_libre",
        campos: PERFIL_LISTO,
      }),
    ).toEqual({
      evaluable: true,
      pedido: false,
      fuente: "sin_pedido",
    });
  });

  it("composePedidoCatalogoFromCampos usa cotizar + slots", () => {
    expect(composePedidoCatalogoFromCampos(PERFIL_LISTO)).toBe(
      "Cotizar paquetes de boda para 150 invitados el 2027-12-22",
    );
  });

  it("parseCtaGuion reconoce títulos y descripciones de la lista v4", () => {
    expect(parseCtaGuion("Conocer Tres Cielos")).toBe("visita");
    expect(parseCtaGuion("Quiero conocer Tres Cielos.")).toBe("visita");
    expect(parseCtaGuion("Tengo dudas")).toBe("ejecutivo");
    expect(
      parseCtaGuion("Tengo dudas, quiero hablar con un ejecutivo."),
    ).toBe("ejecutivo");
    expect(parseCtaGuion("Estamos fuera de tu presupuesto")).toBe(
      "fuera_presupuesto",
    );
  });
});
