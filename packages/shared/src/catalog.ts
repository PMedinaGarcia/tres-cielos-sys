import { z } from "zod";

export const TipoEventoSchema = z.enum([
  "boda",
  "xv",
  "corporativo",
  "social",
  "otro",
  "multi",
]);
export type TipoEvento = z.infer<typeof TipoEventoSchema>;

export const EstadoPublicacionSchema = z.enum([
  "borrador",
  "publicado",
  "archivado",
]);
export type EstadoPublicacion = z.infer<typeof EstadoPublicacionSchema>;

export const CategoriaInclusionSchema = z.enum([
  "catering",
  "mobiliario",
  "audio",
  "decoracion",
  "personal",
  "otro",
]);
export type CategoriaInclusion = z.infer<typeof CategoriaInclusionSchema>;

export const UnidadPrecioSchema = z.enum(["evento", "persona", "otro"]);
export type UnidadPrecio = z.infer<typeof UnidadPrecioSchema>;

export const TipoReglaSchema = z.enum([
  "solo_fin_semana",
  "no_feriados",
  "anticipo_minimo",
  "horario",
  "otro",
]);
export type TipoRegla = z.infer<typeof TipoReglaSchema>;

export const PaqueteRowSchema = z.object({
  sku: z.string().min(1),
  nombre: z.string().min(1),
  tipo_evento: TipoEventoSchema,
  sede: z.string().optional().nullable(),
  aforo_min: z.coerce.number().int().nonnegative(),
  aforo_max: z.coerce.number().int().positive(),
  descripcion_corta: z.string().optional().nullable(),
  estado: EstadoPublicacionSchema.default("publicado"),
});

export const PrecioRowSchema = z.object({
  sku: z.string().min(1),
  moneda: z.string().default("MXN"),
  monto: z.coerce.number().nonnegative().optional().nullable(),
  rango_min: z.coerce.number().nonnegative().optional().nullable(),
  rango_max: z.coerce.number().nonnegative().optional().nullable(),
  unidad: UnidadPrecioSchema.default("evento"),
  vigente_desde: z.string().min(1),
  vigente_hasta: z.string().optional().nullable(),
  condiciones: z.string().optional().nullable(),
});

export const InclusionRowSchema = z.object({
  sku: z.string().min(1),
  categoria: CategoriaInclusionSchema,
  nombre: z.string().min(1),
  cantidad: z.coerce.number().optional().nullable(),
  unidad: z.string().optional().nullable(),
  obligatoria: z
    .union([z.boolean(), z.string()])
    .transform((v) => {
      if (typeof v === "boolean") return v;
      const s = v.trim().toLowerCase();
      return s === "true" || s === "1" || s === "si" || s === "sí" || s === "yes";
    }),
});

export const ReglaRowSchema = z.object({
  sku: z.string().min(1),
  tipo: TipoReglaSchema,
  parametros_json: z.string().optional().nullable(),
  mensaje_prospecto: z.string().optional().nullable(),
});

export const CatalogSnapshotSchema = z.object({
  paquetes: z.array(PaqueteRowSchema).min(1),
  precios: z.array(PrecioRowSchema).min(1),
  inclusiones: z.array(InclusionRowSchema).default([]),
  reglas: z.array(ReglaRowSchema).default([]),
});

export type CatalogSnapshot = z.infer<typeof CatalogSnapshotSchema>;

export const GoldenQaCaseSchema = z.object({
  id: z.string(),
  intent: z.string(),
  tool: z.enum([
    "buscar_paquetes",
    "obtener_precio_paquete",
    "listar_inclusiones",
    "comparar_paquetes",
    "evaluar_reglas_paquete",
  ]),
  input: z.record(z.unknown()),
  expect: z.record(z.unknown()),
});

export type GoldenQaCase = z.infer<typeof GoldenQaCaseSchema>;

/** Tramos oficiales de la ficha Paquete Bodas 2027. No interpolar. */
export const AFORO_TRAMOS_BODA = [100, 150, 200, 250, 300] as const;
export type AforoTramoBoda = (typeof AFORO_TRAMOS_BODA)[number];

/** Fecha de evento por defecto al cotizar la ficha 2027 (no la fecha de consulta). */
export const FECHA_EVENTO_DEFAULT_CATALOGO = "2027-06-15";

/** Año de la ficha de tarifas publicada. Deriva de `FECHA_EVENTO_DEFAULT_CATALOGO`. */
export function anioTarifaPublicada(
  fechaDefault: string = FECHA_EVENTO_DEFAULT_CATALOGO,
): number {
  const y = Number(/^(\d{4})/.exec(fechaDefault)?.[1]);
  return Number.isFinite(y) && y >= 2000 ? y : 2027;
}

/** Ejemplos de fecha alineados a la ficha de tarifas (no al año civil actual). */
export function ejemploFechaTarifaPublicada(
  anio: number = anioTarifaPublicada(),
): { humana: string; dmy: string } {
  return {
    humana: `22 de diciembre de ${anio}`,
    dmy: `15/03/${anio}`,
  };
}

export const SKU_PAQUETE_ESTANDAR = "EVT-J1-TC";
export const SKU_PAQUETE_PREMIUM = "EVT-J1-PREMIUM";
export const SKU_SOLO_RENTA = "RENTA-J1";
export const SKUS_BODA_PUBLICADOS = [
  SKU_PAQUETE_ESTANDAR,
  SKU_PAQUETE_PREMIUM,
] as const;

const LEGACY_SKU: Record<string, string> = {
  "BODA-J1-ESENCIAL": SKU_PAQUETE_ESTANDAR,
  "BODA-J1-PREMIUM": SKU_PAQUETE_PREMIUM,
  "XV-J1-CLASICO": SKU_PAQUETE_ESTANDAR,
};

export function isAforoTramoBoda(n: number): n is AforoTramoBoda {
  return (AFORO_TRAMOS_BODA as readonly number[]).includes(n);
}

/** Normaliza SKU de catálogo, incluyendo alias del golden de prueba. */
export function canonicalizeSku(
  sku: string | null | undefined,
): string | undefined {
  if (sku == null) return undefined;
  const trimmed = sku.trim();
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();
  return LEGACY_SKU[upper] ?? upper;
}

/**
 * Resuelve un nombre informal o SKU en el texto del lead al SKU publicado.
 * Si hay varios candidatos (p. ej. comparar), no fuerza uno.
 */
export function resolvePaqueteSkuAlias(
  text: string,
): string | undefined {
  const skuMatch = text
    .toUpperCase()
    .match(/\b(EVT-J1-PREMIUM|EVT-J1-TC|RENTA-J1|BODA-J1-PREMIUM|BODA-J1-ESENCIAL)\b/);
  if (skuMatch?.[1]) return canonicalizeSku(skuMatch[1]);

  const lower = text.toLowerCase();
  const mentionsPremium = /premium|upgrade/.test(lower);
  const mentionsEstandar =
    /esencial|b[aá]sico|est[aá]ndar|standar|\btc\b|paquete bodas/.test(lower);
  if (mentionsPremium && mentionsEstandar) return undefined;
  if (mentionsPremium) return SKU_PAQUETE_PREMIUM;
  if (mentionsEstandar) return SKU_PAQUETE_ESTANDAR;
  if (/solo\s+renta|\brenta\b/.test(lower) && !/paquete/.test(lower)) {
    return SKU_SOLO_RENTA;
  }
  return undefined;
}
