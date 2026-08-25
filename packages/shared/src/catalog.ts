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
