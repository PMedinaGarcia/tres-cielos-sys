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

/** Total del evento: por persona × tramo; otras unidades usan el monto crudo. */
export function totalEventoFromPrecio(row: PrecioRowLike): number | null {
  if (row.monto == null || !Number.isFinite(row.monto) || row.monto <= 0) {
    return null;
  }
  if (row.unidad === "persona") {
    const tramo = row.rangoMin ?? row.rangoMax;
    if (tramo == null || !Number.isFinite(tramo) || tramo <= 0) return null;
    return row.monto * tramo;
  }
  return row.monto;
}

export function pickSkuBajoPiso<
  T extends PrecioRowLike & { sku: string; nombre: string },
>(
  rows: T[],
  pisoMxn: number,
): { sku: string; nombre: string; monto: number } | null {
  let best: { sku: string; nombre: string; monto: number } | null = null;
  for (const row of rows) {
    const total = totalEventoFromPrecio(row);
    if (total == null || total >= pisoMxn) continue;
    if (!best || total > best.monto) {
      best = { sku: row.sku, nombre: row.nombre, monto: total };
    }
  }
  return best;
}

/** Paquete publicado más económico por total de evento del tramo de partida. */
export function pickSkuPisoVigente(
  paquetes: Array<{ sku: string; nombre: string; precios: PrecioRowLike[] }>,
): { sku: string; nombre: string; monto: number } | null {
  let best: { sku: string; nombre: string; monto: number } | null = null;
  for (const p of paquetes) {
    const match = matchPrecioPorAforo(p.precios);
    if (match.kind !== "exact" && match.kind !== "desde") continue;
    const total = match.totalEvento;
    if (!Number.isFinite(total) || total <= 0) continue;
    if (!best || total < best.monto) {
      best = { sku: p.sku, nombre: p.nombre, monto: total };
    }
  }
  return best;
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
