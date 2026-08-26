/** OpenAI function definitions — espejo snake_case del orquestador. */
export const TOOL_CATALOG_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "buscar_paquetes",
      description:
        "Busca paquetes publicados por tipo de evento, aforo y sede. No inventar precios.",
      parameters: {
        type: "object",
        properties: {
          tipoEvento: {
            type: "string",
            enum: ["boda", "xv", "corporativo", "social", "otro", "multi"],
          },
          aforo: { type: "number" },
          sede: { type: "string" },
          fecha: {
            type: "string",
            description:
              "Fecha del evento YYYY-MM-DD; filtra vigencia de precios (si falta, se usa 2027-06-15 de la ficha Bodas 2027).",
          },
        },
        required: ["tipoEvento"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "obtener_precio_paquete",
      description:
        "Obtiene el precio vigente de un paquete por SKU o id y aforo. Única fuente de montos. No interpolar tramos; solo 100/150/200/250/300.",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string" },
          paqueteId: { type: "string" },
          aforo: { type: "number" },
          fecha: {
            type: "string",
            description:
              "Fecha del evento YYYY-MM-DD para vigencia (si falta, se usa 2027-06-15).",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "listar_inclusiones",
      description: "Lista inclusiones de un paquete publicado.",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string" },
          paqueteId: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "comparar_paquetes",
      description: "Compara hasta 3 paquetes (precio + inclusiones clave).",
      parameters: {
        type: "object",
        properties: {
          skus: { type: "array", items: { type: "string" } },
          ids: { type: "array", items: { type: "string" } },
          aforo: { type: "number" },
          fecha: {
            type: "string",
            description: "Fecha del evento YYYY-MM-DD para vigencia de precios.",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "evaluar_reglas_paquete",
      description: "Evalúa reglas comerciales del paquete (anticipo, horario, etc.).",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string" },
          paqueteId: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "transferir_a_humano",
      description: "Transfiere el hilo a un asesor humano.",
      parameters: {
        type: "object",
        properties: {
          motivo: {
            type: "string",
            enum: [
              "solicitud_usuario",
              "sin_catalogo",
              "conflicto",
              "queja",
              "descuento_fuera_catalogo",
              "sede_no_cubierta",
              "ambiguiedad",
              "otro",
            ],
          },
        },
        required: ["motivo"],
      },
    },
  },
] as const;

export type ToolCatalogName =
  | "buscar_paquetes"
  | "obtener_precio_paquete"
  | "listar_inclusiones"
  | "comparar_paquetes"
  | "evaluar_reglas_paquete"
  | "transferir_a_humano";

/** Vista mutable para LlmPort.tools (evita narrowing `as const` → never). */
export function toolCatalogDefinitions(): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return TOOL_CATALOG_SCHEMAS.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters as Record<string, unknown>,
  }));
}
