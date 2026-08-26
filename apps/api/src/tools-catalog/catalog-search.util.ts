export function aforoDistance(
  aforo: number | undefined,
  aforoMin: number,
  aforoMax: number,
): number {
  if (aforo == null) return 0;
  if (aforo >= aforoMin && aforo <= aforoMax) return 0;
  if (aforo < aforoMin) return aforoMin - aforo;
  return aforo - aforoMax;
}

export function pickCercanos<T extends { aforoMin: number; aforoMax: number }>(
  items: T[],
  aforo: number | undefined,
  n = 1,
): T[] {
  return [...items]
    .sort(
      (a, b) =>
        aforoDistance(aforo, a.aforoMin, a.aforoMax) -
        aforoDistance(aforo, b.aforoMin, b.aforoMax),
    )
    .slice(0, n);
}

export function normalizeTipoEventoArg(tipo: unknown): string | undefined {
  if (tipo == null) return undefined;
  const t = String(tipo).trim().toLowerCase();
  return t || undefined;
}

export type MotivoSinCoincidencia = "aforo" | "sede" | "tipo" | "sin_publicados";

export interface PrecioMuestra {
  monto?: number;
  moneda?: string;
  unidad?: string;
  aforoTramo?: number;
  totalEvento?: number;
  desde?: boolean;
}

export interface PaqueteCatalogoVista {
  id?: string;
  sku?: string;
  nombre?: string;
  tipoEvento?: string;
  sede?: string;
  aforoMin?: number;
  aforoMax?: number;
  descripcionCorta?: string | null;
  precioMuestra?: PrecioMuestra | null;
  precioTramo?: "exact" | "desde" | "sin_interpolar" | "sin_vigente";
  tramosPublicados?: number[];
}

export interface DiagnosticoBusquedaVacia {
  motivo: MotivoSinCoincidencia;
  aforoLead?: number;
  aforoMinCatalogo?: number;
  aforoMaxCatalogo?: number;
  tipoEvento?: string;
  cercanos: PaqueteCatalogoVista[];
}

