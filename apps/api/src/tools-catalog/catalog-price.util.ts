import {
  AFORO_TRAMOS_BODA,
  FECHA_EVENTO_DEFAULT_CATALOGO,
  isAforoTramoBoda,
} from "@tres-cielos/shared";

export type PrecioRowLike = {
  monto: number | null;
  moneda: string;
  unidad: string;
  rangoMin: number | null;
  rangoMax: number | null;
};

export type PrecioMatch =
  | {
      kind: "exact";
      row: PrecioRowLike;
      aforoTramo: number;
      totalEvento: number;
    }
  | {
      kind: "desde";
      row: PrecioRowLike;
      aforoTramo: number;
      totalEvento: number;
    }
  | { kind: "sin_interpolar"; tramosPublicados: number[]; aforo: number }
  | { kind: "sin_vigente" };

export function fechaConsultaDate(fecha?: string): Date {
  const raw = fecha?.trim() || FECHA_EVENTO_DEFAULT_CATALOGO;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) {
    const fallback = FECHA_EVENTO_DEFAULT_CATALOGO.match(
      /^(\d{4})-(\d{2})-(\d{2})$/,
    )!;
    return new Date(
      Date.UTC(
        Number(fallback[1]),
        Number(fallback[2]) - 1,
        Number(fallback[3]),
        12,
        0,
        0,
      ),
    );
  }
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0),
  );
}

export function vigenciaWhere(fechaConsulta: Date) {
  return {
    estado: "publicado" as const,
    vigenteDesde: { lte: fechaConsulta },
    OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fechaConsulta } }],
  };
}

function personaRows(precios: PrecioRowLike[]): PrecioRowLike[] {
  return precios.filter(
    (p) => p.unidad === "persona" && p.monto != null && Number.isFinite(p.monto),
  );
}

function rowForTramo(
  rows: PrecioRowLike[],
  tramo: number,
): PrecioRowLike | undefined {
  return rows.find(
    (p) => Number(p.rangoMin) === tramo && Number(p.rangoMax) === tramo,
  );
}

export function matchPrecioPorAforo(
  precios: PrecioRowLike[],
  aforo?: number,
): PrecioMatch {
  const rows = personaRows(precios);
  if (aforo != null && isAforoTramoBoda(aforo)) {
    const row = rowForTramo(rows, aforo);
    if (!row || row.monto == null) return { kind: "sin_vigente" };
    return {
      kind: "exact",
      row,
      aforoTramo: aforo,
      totalEvento: row.monto * aforo,
    };
  }
  if (aforo != null) {
    const mins = rows
      .map((r) => r.rangoMin)
      .filter((n): n is number => n != null);
    const maxs = rows
      .map((r) => r.rangoMax)
      .filter((n): n is number => n != null);
    const minT = mins.length ? Math.min(...mins) : 100;
    const maxT = maxs.length ? Math.max(...maxs) : 300;
    if (aforo >= minT && aforo <= maxT) {
      return {
        kind: "sin_interpolar",
        tramosPublicados: [...AFORO_TRAMOS_BODA],
        aforo,
      };
    }
  }

  if (rows.length === 0) {
    const fallback = precios.find((p) => p.monto != null);
    if (!fallback) return { kind: "sin_vigente" };
    return {
      kind: "desde",
      row: fallback,
      aforoTramo: Number(fallback.rangoMin) || 0,
      totalEvento: fallback.monto ?? 0,
    };
  }

  const desde =
    rowForTramo(rows, AFORO_TRAMOS_BODA[0]) ??
    [...rows].sort((a, b) => (b.monto ?? 0) - (a.monto ?? 0))[0];
  if (!desde || desde.monto == null) return { kind: "sin_vigente" };
  const tramo = Number(desde.rangoMin) || AFORO_TRAMOS_BODA[0];
  return {
    kind: "desde",
    row: desde,
    aforoTramo: tramo,
    totalEvento: desde.monto * tramo,
  };
}
