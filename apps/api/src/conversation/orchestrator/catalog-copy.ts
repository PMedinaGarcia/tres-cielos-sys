/** Copy de prospecto para tools de catálogo: nombres comerciales, sin SKU ni jerga de filtros. */

import {
  AFORO_TRAMOS_BODA,
  SEDE_NOMBRE,
  anioTarifaPublicada,
  copySedeUbicacionCorta,
  ejemploFechaTarifaPublicada,
} from "@tres-cielos/shared";
import type {
  DiagnosticoBusquedaVacia,
  PaqueteCatalogoVista,
} from "../../tools-catalog/catalog-search.util";
import {
  contrasteBuscarPaquetes,
  FAQ_CTA,
  fichaPaquetePorSku,
} from "./commercial-faq.copy";

export type { DiagnosticoBusquedaVacia, PaqueteCatalogoVista };

export function formatMonto(moneda: string, monto: number): string {
  const n = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(
    monto,
  );
  return `${moneda} ${n}`;
}

function aforoRango(min?: number, max?: number): string {
  if (min == null || max == null) return "";
  return ` (${min} a ${max} personas)`;
}

function nombrePaquete(p: PaqueteCatalogoVista): string {
  const n = typeof p.nombre === "string" ? p.nombre.trim() : "";
  return n || "este paquete";
}

function unidadLabel(unidad?: string): string {
  if (unidad === "persona") return "por persona";
  if (unidad === "evento") return "por evento";
  return unidad ? `por ${unidad}` : "por persona";
}

function tramosLabel(tramos?: number[]): string {
  const t = tramos?.length ? tramos : [...AFORO_TRAMOS_BODA];
  return t.join(", ");
}

function lineaPaquete(
  p: PaqueteCatalogoVista,
  opts?: { sinPrecioVigente?: boolean },
): { texto: string; monto?: number } {
  const nombre = nombrePaquete(p);
  const rango = aforoRango(p.aforoMin, p.aforoMax);
  if (p.precioTramo === "sin_interpolar") {
    return { texto: `- ${nombre}${rango}` };
  }
  const muestra = p.precioMuestra;
  if (muestra?.monto != null && muestra.moneda) {
    const unidad = unidadLabel(muestra.unidad);
    if (muestra.desde) {
      return {
        texto: `- ${nombre}, desde ${formatMonto(muestra.moneda, muestra.monto)} ${unidad}${rango}`,
        monto: muestra.monto,
      };
    }
    if (muestra.totalEvento != null && muestra.aforoTramo != null) {
      return {
        texto: `- ${nombre}: ${formatMonto(muestra.moneda, muestra.monto)} ${unidad} (${formatMonto(muestra.moneda, muestra.totalEvento)} total, ${muestra.aforoTramo} invitados)`,
        monto: muestra.monto,
      };
    }
    return {
      texto: `- ${nombre}, ${formatMonto(muestra.moneda, muestra.monto)} ${unidad}${rango}`,
      monto: muestra.monto,
    };
  }
  if (opts?.sinPrecioVigente) {
    return {
      texto: `- ${nombre}: para esa fecha aún no hay precio publicado${rango}`,
    };
  }
  return { texto: `- ${nombre}${rango}` };
}

const TIPO_LABEL: Record<string, string> = {
  boda: "boda",
  xv: "XV años",
  corporativo: "evento corporativo",
  social: "evento social",
  otro: "evento",
  multi: "evento",
};

function labelTipo(tipo?: string): string {
  if (!tipo) return "tu evento";
  return TIPO_LABEL[tipo] ?? tipo;
}

const OFERTA_ASESOR =
  "Si prefieres, usa «Hablar con asesor» y te contactamos en 15–30 min.";

function anioPreciosCopy(vigenteDesde?: unknown): number {
  if (vigenteDesde instanceof Date && !Number.isNaN(vigenteDesde.getTime())) {
    return vigenteDesde.getUTCFullYear();
  }
  if (typeof vigenteDesde === "string") {
    const y = Number(/^(\d{4})/.exec(vigenteDesde)?.[1]);
    if (Number.isFinite(y) && y >= 2000) return y;
  }
  return anioTarifaPublicada();
}

function notaIvaTramos(anio = anioTarifaPublicada()): string {
  return `Los precios ${anio} no incluyen IVA. Si me das invitados (100, 150, 200, 250 o 300) te cotizo el total.`;
}

export function redactBuscarPaquetes(result: unknown): {
  texto: string;
  montos: Array<number | string>;
} {
  const montos: Array<number | string> = [];
  const items = Array.isArray(result)
    ? (result as PaqueteCatalogoVista[])
    : [];
  if (items.length === 0) {
    return { texto: "", montos };
  }

  const conPrecio = items.filter((p) => p.precioMuestra?.monto != null);
  const sinPrecio = items.filter((p) => p.precioMuestra?.monto == null);
  const sinInterpolar = items.some((p) => p.precioTramo === "sin_interpolar");
  const lines = items.map((p) => {
    const line = lineaPaquete(p, {
      sinPrecioVigente: sinPrecio.length > 0 && conPrecio.length > 0,
    });
    if (line.monto != null) montos.push(line.monto);
    if (p.precioMuestra?.totalEvento != null && !p.precioMuestra.desde) {
      montos.push(p.precioMuestra.totalEvento);
    }
    return line.texto;
  });

  if (sinInterpolar) {
    return {
      texto: `En ${SEDE_NOMBRE} los paquetes cubren de 100 a 300 personas, pero las tarifas publicadas son solo por tramos de ${tramosLabel(items[0]?.tramosPublicados)} invitados. No cotizo montos intermedios.\n${lines.join("\n")}\n${OFERTA_ASESOR}`,
      montos,
    };
  }

  if (conPrecio.length === 0) {
    const anio = anioTarifaPublicada();
    const ejemplo = ejemploFechaTarifaPublicada(anio);
    return {
      texto: `Estos paquetes aplican para tu evento en ${SEDE_NOMBRE}, pero para esa fecha aún no hay precio publicado (las tarifas vigentes son ${anio}):\n${lines.join("\n")}\nIndica un día, mes y año de ${anio}, por ejemplo ${ejemplo.humana}.\n${OFERTA_ASESOR}`,
      montos,
    };
  }

  const intro = `Para tu evento en ${SEDE_NOMBRE} encontré:`;
  const desde = items.some((p) => p.precioMuestra?.desde);
  const anio = anioTarifaPublicada();
  const nota =
    sinPrecio.length > 0
      ? `\nNo cotizo montos que no estén vigentes para esa fecha.`
      : desde
        ? `\n${notaIvaTramos(anio)}`
        : `\nLos precios ${anio} no incluyen IVA.`;
  return {
    texto: `${intro}\n${lines.join("\n")}${nota}\n${contrasteBuscarPaquetes()}`,
    montos,
  };
}

export function redactBusquedaVacia(diag: DiagnosticoBusquedaVacia): {
  texto: string;
  montos: Array<number | string>;
} {
  const montos: Array<number | string> = [];
  const cercano = diag.motivo === "aforo" ? diag.cercanos[0] : undefined;
  let cercanoLine = "";
  if (cercano) {
    const line = lineaPaquete(cercano);
    if (line.monto != null) montos.push(line.monto);
    cercanoLine = ` El más cercano es ${nombrePaquete(cercano)}${aforoRango(cercano.aforoMin, cercano.aforoMax)}${
      cercano.precioMuestra?.monto != null && cercano.precioMuestra.moneda
        ? `, desde ${formatMonto(cercano.precioMuestra.moneda, cercano.precioMuestra.monto)} ${unidadLabel(cercano.precioMuestra.unidad)}`
        : ""
    }.`;
  }

  let motivo = "";
  if (diag.motivo === "aforo" && diag.aforoLead != null) {
    const rangoCat =
      diag.aforoMinCatalogo != null && diag.aforoMaxCatalogo != null
        ? ` Los publicados para ${labelTipo(diag.tipoEvento)} en ${SEDE_NOMBRE} cubren de ${diag.aforoMinCatalogo} a ${diag.aforoMaxCatalogo} personas.`
        : "";
    motivo = `Con ${diag.aforoLead} personas no hay un paquete publicado que cubra ese aforo.${rangoCat}`;
  } else if (diag.motivo === "sede") {
    motivo = `Nuestra sede es ${copySedeUbicacionCorta()}. Si buscabas otra locación, un asesor te orienta.`;
  } else if (diag.motivo === "tipo") {
    motivo = `Aún no hay paquetes publicados para ${labelTipo(diag.tipoEvento)} en ${SEDE_NOMBRE}.`;
  } else {
    motivo = `En este momento no hay paquetes publicados que coincidan con tu evento en ${SEDE_NOMBRE}.`;
  }

  const ajuste =
    diag.motivo === "aforo"
      ? " Puedes ajustar el número de invitados o te armo una propuesta a medida."
      : "";

  return {
    texto: `${motivo}${cercanoLine}${ajuste} ${OFERTA_ASESOR}`
      .replace(/\s+/g, " ")
      .trim(),
    montos,
  };
}

export function redactPrecioPaquete(r: Record<string, unknown>): {
  texto: string;
  montos: Array<number | string>;
  paqueteId: string | null;
  precioSnapshot: Record<string, unknown> | null;
} {
  const monto = typeof r.monto === "number" ? r.monto : null;
  const moneda = typeof r.moneda === "string" ? r.moneda : "MXN";
  const nombre =
    typeof r.nombre === "string" && r.nombre.trim()
      ? r.nombre.trim()
      : "este paquete";
  const unidad = unidadLabel(
    typeof r.unidad === "string" ? r.unidad : "persona",
  );
  const paqueteId = typeof r.paqueteId === "string" ? r.paqueteId : null;
  const totalEvento = typeof r.totalEvento === "number" ? r.totalEvento : null;
  const aforoTramo = typeof r.aforoTramo === "number" ? r.aforoTramo : null;
  const desde = r.desde === true;
  const montos: Array<number | string> = [];
  if (monto != null) montos.push(monto);
  if (totalEvento != null && !desde) montos.push(totalEvento);
  const precioSnapshot =
    monto != null
      ? {
          moneda: r.moneda,
          monto: r.monto,
          rangoMin: r.rangoMin,
          rangoMax: r.rangoMax,
          unidad: r.unidad,
          vigenteDesde: r.vigenteDesde,
          vigenteHasta: r.vigenteHasta,
          totalEvento: r.totalEvento,
          aforoTramo: r.aforoTramo,
        }
      : null;

  let texto: string;
  const anio = anioPreciosCopy(r.vigenteDesde);
  if (monto == null) {
    texto = `El paquete ${nombre} está publicado, pero para esa fecha aún no hay precio vigente. ${OFERTA_ASESOR}`;
  } else if (desde) {
    texto = `El ${nombre} en ${SEDE_NOMBRE} tiene tarifa ${anio} desde ${formatMonto(moneda, monto)} ${unidad} (100 invitados). ${notaIvaTramos(anio)}`;
  } else if (totalEvento != null && aforoTramo != null) {
    texto = `El ${nombre} en ${SEDE_NOMBRE} tiene precio vigente de ${formatMonto(moneda, monto)} ${unidad} (${formatMonto(moneda, totalEvento)} total, ${aforoTramo} invitados). Los precios ${anio} no incluyen IVA.`;
  } else {
    texto = `El paquete ${nombre} tiene precio vigente de ${formatMonto(moneda, monto)} ${unidad}.`;
  }

  return { texto, montos, paqueteId, precioSnapshot };
}

export function redactSinTramoExacto(result: unknown): {
  texto: string;
  montos: Array<number | string>;
} {
  const r =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const nombre =
    typeof r.nombre === "string" && r.nombre.trim()
      ? r.nombre.trim()
      : "ese paquete";
  const aforo = typeof r.aforo === "number" ? r.aforo : null;
  const tramos = Array.isArray(r.tramosPublicados)
    ? (r.tramosPublicados as number[])
    : [...AFORO_TRAMOS_BODA];
  const invitados = aforo != null ? `Con ${aforo} personas, ` : "";
  return {
    texto: `${invitados}el ${nombre} se cotiza solo en tramos de ${tramosLabel(tramos)} invitados; no interpolo montos. ${OFERTA_ASESOR}`,
    montos: [],
  };
}

export function redactSinPrecioVigente(result: unknown): {
  texto: string;
  montos: Array<number | string>;
} {
  const r =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const nombre =
    typeof r.nombre === "string" && r.nombre.trim()
      ? r.nombre.trim()
      : "ese paquete";
  return {
    texto: `El paquete ${nombre} está publicado, pero para esa fecha aún no hay precio vigente. ${OFERTA_ASESOR}`,
    montos: [],
  };
}

/** Prioridad comercial para el prospecto (menor = más importante). */
function prioridadInclusion(item: {
  nombre?: string;
  categoria?: string;
}): number {
  const n = (item.nombre ?? "").toLowerCase();
  if (/tres d[ií]as|viernes cortes[ií]a/.test(n)) return 10;
  if (/jard[ií]n/.test(n)) return 20;
  if (/capilla|ceremonia/.test(n)) return 30;
  if (/banquete|men[uú]|barra libre/.test(n) && !/no incluye/.test(n)) {
    return 40;
  }
  if (/suite|nupcial/.test(n)) return 50;
  if (/\bvalet\b/.test(n)) return 60;
  if (/\bdj\b|audio|m[uú]sica/.test(n)) return 70;
  if (/table styling|sillas|plaf[oó]n|mobiliario/.test(n)) return 80;
  if (/planner|coordinaci[oó]n/.test(n)) return 90;
  if (item.categoria === "catering") return 42;
  if (item.categoria === "decoracion") return 45;
  if (item.categoria === "audio") return 72;
  if (item.categoria === "mobiliario") return 82;
  if (item.categoria === "personal") return 85;
  return 100;
}

function ordenarInclusiones<T extends { nombre?: string; categoria?: string }>(
  items: T[],
): T[] {
  return items
    .map((item, index) => ({ item, index, p: prioridadInclusion(item) }))
    .sort((a, b) => a.p - b.p || a.index - b.index)
    .map((x) => x.item);
}

function lineaInclusionNumerada(nombre: string, index: number): string {
  const trimmed = nombre.trim().replace(/[.;]+$/u, "");
  return `${index + 1}. ${trimmed}.`;
}

function tituloPaquete(nombre: string): string {
  if (/^est[ea] paquete$/i.test(nombre)) {
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }
  return `El ${nombre}`;
}

export function redactCompararPaquetes(r: Record<string, unknown>): {
  texto: string;
  montos: Array<number | string>;
} {
  const montos: Array<number | string> = [];
  const items = (r.items as Array<Record<string, unknown>>) ?? [];
  const lines = items.map((i) => {
    const precio = i.precio as {
      monto?: number;
      moneda?: string;
      unidad?: string;
      totalEvento?: number;
      aforoTramo?: number;
      desde?: boolean;
    } | null;
    const nombre =
      typeof i.nombre === "string" && i.nombre.trim()
        ? i.nombre.trim()
        : "paquete";
    const inclusiones =
      (i.inclusiones as Array<{ nombre?: string; categoria?: string }>) ?? [];
    const extra =
      inclusiones.length > 0
        ? ` · ${ordenarInclusiones(inclusiones)
            .slice(0, 4)
            .map((x) => x.nombre)
            .filter(Boolean)
            .join("; ")}`
        : "";
    if (precio?.monto != null && precio.moneda) {
      montos.push(precio.monto);
      if (precio.totalEvento != null && !precio.desde) {
        montos.push(precio.totalEvento);
      }
      const unidad = unidadLabel(precio.unidad);
      if (precio.desde) {
        return `- ${nombre} · desde ${formatMonto(precio.moneda, precio.monto)} ${unidad}${extra}`;
      }
      if (precio.totalEvento != null && precio.aforoTramo != null) {
        return `- ${nombre} · ${formatMonto(precio.moneda, precio.monto)} ${unidad} (${formatMonto(precio.moneda, precio.totalEvento)} total, ${precio.aforoTramo} invitados)${extra}`;
      }
      return `- ${nombre} · ${formatMonto(precio.moneda, precio.monto)}${extra}`;
    }
    if (
      i.precioError &&
      typeof i.precioError === "object" &&
      (i.precioError as { error?: string }).error === "sin_tramo_exacto"
    ) {
      return `- ${nombre} · se cotiza solo en tramos publicados${extra}`;
    }
    return `- ${nombre} · para esa fecha aún no hay precio vigente${extra}`;
  });
  return {
    texto: `Comparación en ${SEDE_NOMBRE}:\n${lines.join("\n")}\nLos precios ${anioTarifaPublicada()} no incluyen IVA.`,
    montos,
  };
}

export function redactInclusiones(r: Record<string, unknown>): {
  texto: string;
  montos: Array<number | string>;
  paqueteId: string | null;
} {
  const paqueteId = typeof r.paqueteId === "string" ? r.paqueteId : null;
  const inclusiones =
    (r.inclusiones as Array<{ nombre: string; categoria?: string }>) ?? [];
  const nombre =
    typeof r.nombre === "string" && r.nombre.trim()
      ? r.nombre.trim()
      : "este paquete";
  const ranked = ordenarInclusiones(inclusiones);
  const listed = ranked;
  const sku = typeof r.sku === "string" ? r.sku : null;
  const ficha = fichaPaquetePorSku(sku);
  const titulo = tituloPaquete(nombre);
  if (listed.length === 0 && !ficha) {
    return {
      texto: `${titulo} no tiene inclusiones publicadas.\n\n${FAQ_CTA}`,
      montos: [],
      paqueteId,
    };
  }
  const lines = listed.map((i, idx) => lineaInclusionNumerada(i.nombre, idx));
  const lista =
    listed.length > 0
      ? `${ficha ? "Inclusiones publicadas:\n\n" : `${titulo} incluye:\n\n`}${lines.join("\n")}`
      : "";
  const partes = [ficha, lista, FAQ_CTA].filter(
    (p): p is string => !!p && p.trim().length > 0,
  );
  return {
    texto: partes.join("\n\n"),
    montos: [],
    paqueteId,
  };
}

export function redactReglas(r: Record<string, unknown>): {
  texto: string;
  montos: Array<number | string>;
  paqueteId: string | null;
} {
  const paqueteId = typeof r.paqueteId === "string" ? r.paqueteId : null;
  const nombre =
    typeof r.nombre === "string" && r.nombre.trim()
      ? r.nombre.trim()
      : "Tres Cielos Tequesquitengo";
  const reglas =
    (r.reglas as Array<{ tipo: string; mensajeProspecto?: string }>) ?? [];
  const mensajes = reglas
    .map((x) => x.mensajeProspecto)
    .filter((m): m is string => !!m && m.trim().length > 0);
  const texto = `Políticas de ${nombre}:\n${
    mensajes.map((m) => `• ${m}`).join("\n") || "• sin reglas publicadas."
  }`;
  const montos: Array<number | string> = [];
  for (const m of mensajes) {
    for (const hit of m.matchAll(/\b(?:mxn|usd)\s+(\d[\d,]*(?:\.\d+)?)/gi)) {
      montos.push(Number(hit[1].replace(/,/g, "")));
    }
  }
  return { texto, montos, paqueteId };
}
