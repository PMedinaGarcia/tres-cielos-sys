import {
  canonicalizeSku,
  resolvePaqueteSkuAlias,
  SKU_PAQUETE_ESTANDAR,
  SKU_PAQUETE_PREMIUM,
  SKU_SOLO_RENTA,
  SKUS_BODA_PUBLICADOS,
} from "@tres-cielos/shared";
import { isPackageDetailQuery } from "../orchestrator/commercial-faq.matcher";

export type PlannedToolCall = {
  name: string;
  args: Record<string, unknown>;
};

function aforoFromText(text: string): number | undefined {
  const m = text.match(/\b(\d{2,4})\b/);
  return m ? Number(m[1]) : undefined;
}

function skuFromText(text: string): string | undefined {
  const explicit = text
    .toUpperCase()
    .match(/\b([A-Z]{2,}(?:-[A-Z0-9]+)+)\b/);
  if (explicit?.[1]) return canonicalizeSku(explicit[1]);
  return resolvePaqueteSkuAlias(text);
}

/** Heurística determinista del planner de catálogo (CI + fake LLM). */
export function planCatalogToolsFromText(
  text: string,
  available: Set<string>,
): PlannedToolCall[] {
  const lower = text.toLowerCase();
  const sku = skuFromText(text);
  const aforo = aforoFromText(text);

  if (/hablar con|asesor|humano|persona real|agente/.test(lower)) {
    if (available.has("transferir_a_humano")) {
      return [{ name: "transferir_a_humano", args: { motivo: "solicitud_usuario" } }];
    }
  }

  if (
    (/\bxv\b|quinceañer|quinceanier/.test(lower) ||
      /corporativ/.test(lower) ||
      /solo\s+renta/.test(lower)) &&
    available.has("transferir_a_humano")
  ) {
    return [{ name: "transferir_a_humano", args: { motivo: "sin_catalogo" } }];
  }

  if (
    /cu[aá]nto (me )?(descuentan|rebajan)|descuento exacto/.test(lower) &&
    available.has("transferir_a_humano")
  ) {
    return [
      {
        name: "transferir_a_humano",
        args: { motivo: "descuento_fuera_catalogo" },
      },
    ];
  }

  if (/compar(a|ar)|diferencia/.test(lower) && available.has("comparar_paquetes")) {
    const skus = sku
      ? [sku]
      : [...SKUS_BODA_PUBLICADOS];
    if (skus.length === 1) {
      const other =
        sku === SKU_PAQUETE_PREMIUM
          ? SKU_PAQUETE_ESTANDAR
          : SKU_PAQUETE_PREMIUM;
      skus.push(other);
    }
    return [
      {
        name: "comparar_paquetes",
        args: {
          skus: skus.slice(0, 3),
          ...(aforo != null ? { aforo } : {}),
        },
      },
    ];
  }

  if (
    isPackageDetailQuery(text) ||
    /incluye|inclusiones|qu[eé] trae|que trae|que tiene|detalle|ficha|de que consta|contenido/.test(
      lower,
    )
  ) {
    if (available.has("listar_inclusiones")) {
      if (sku) {
        return [{ name: "listar_inclusiones", args: { sku } }];
      }
      return SKUS_BODA_PUBLICADOS.map((s) => ({
        name: "listar_inclusiones",
        args: { sku: s },
      }));
    }
  }

  if (
    /regla|anticipo|pol[ií]tica|fin de semana|feriado|temporada baja|descuento/.test(
      lower,
    )
  ) {
    if (available.has("evaluar_reglas_paquete")) {
      return [
        {
          name: "evaluar_reglas_paquete",
          args: { sku: sku ?? SKU_PAQUETE_ESTANDAR },
        },
      ];
    }
  }

  if (
    /precio|preico|cuesta|cu[aá]nto|kuanto|custa|costo|cotiz|tarifa/.test(
      lower,
    ) &&
    sku &&
    sku !== SKU_SOLO_RENTA &&
    available.has("obtener_precio_paquete")
  ) {
    return [
      {
        name: "obtener_precio_paquete",
        args: { sku, ...(aforo != null ? { aforo } : {}) },
      },
    ];
  }

  if (
    (/paquete|buscar|opciones|boda|xv|corporativo/.test(lower) ||
      /precio|preico|cuesta|cu[aá]nto|kuanto|custa|costo|cotiz|tarifa/.test(
        lower,
      )) &&
    available.has("buscar_paquetes")
  ) {
    let tipoEvento = "boda";
    if (/\bxv\b|quince/.test(lower)) tipoEvento = "xv";
    if (/corporativ/.test(lower)) tipoEvento = "corporativo";
    return [
      {
        name: "buscar_paquetes",
        args: {
          tipoEvento,
          ...(aforo != null ? { aforo } : {}),
        },
      },
    ];
  }

  if (sku && available.has("obtener_precio_paquete")) {
    return [
      {
        name: "obtener_precio_paquete",
        args: { sku, ...(aforo != null ? { aforo } : {}) },
      },
    ];
  }

  return [];
}
