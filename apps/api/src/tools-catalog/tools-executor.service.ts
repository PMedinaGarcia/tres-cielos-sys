import { Injectable } from "@nestjs/common";
import { CatalogToolsService } from "./catalog-tools.service";
import type { ToolCatalogName } from "./tool-schemas";

export interface ToolCallRequest {
  name: ToolCatalogName | string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  name: string;
  ok: boolean;
  latenciaMs: number;
  filasSku: string[];
  errorCode: string | null;
  result: unknown;
  transferir?: { motivo: string };
}

@Injectable()
export class ToolsExecutorService {
  constructor(private readonly catalog: CatalogToolsService) {}

  async execute(call: ToolCallRequest): Promise<ToolCallResult> {
    const started = Date.now();
    const name = call.name;
    const args = call.arguments ?? {};

    if (name === "transferir_a_humano") {
      return {
        name,
        ok: true,
        latenciaMs: Date.now() - started,
        filasSku: [],
        errorCode: null,
        result: { transferido: true, motivo: args.motivo ?? "solicitud_usuario" },
        transferir: { motivo: String(args.motivo ?? "solicitud_usuario") },
      };
    }

    let result: unknown;
    switch (name) {
      case "buscar_paquetes":
        result = await this.catalog.buscarPaquetes({
          tipoEvento: String(args.tipoEvento ?? "boda"),
          aforo: args.aforo != null ? Number(args.aforo) : undefined,
          sede: args.sede != null ? String(args.sede) : undefined,
          fecha: args.fecha != null ? String(args.fecha) : undefined,
        });
        break;
      case "obtener_precio_paquete":
        result = await this.catalog.obtenerPrecioPaquete({
          sku: args.sku != null ? String(args.sku) : undefined,
          paqueteId: args.paqueteId != null ? String(args.paqueteId) : undefined,
          fecha: args.fecha != null ? String(args.fecha) : undefined,
        });
        break;
      case "listar_inclusiones":
        result = await this.catalog.listarInclusiones({
          sku: args.sku != null ? String(args.sku) : undefined,
          paqueteId: args.paqueteId != null ? String(args.paqueteId) : undefined,
        });
        break;
      case "comparar_paquetes":
        result = await this.catalog.compararPaquetes({
          skus: Array.isArray(args.skus) ? (args.skus as string[]) : undefined,
          ids: Array.isArray(args.ids) ? (args.ids as string[]) : undefined,
          fecha: args.fecha != null ? String(args.fecha) : undefined,
        });
        break;
      case "evaluar_reglas_paquete":
        result = await this.catalog.evaluarReglasPaquete({
          sku: args.sku != null ? String(args.sku) : undefined,
          paqueteId: args.paqueteId != null ? String(args.paqueteId) : undefined,
        });
        break;
      default:
        return {
          name,
          ok: false,
          latenciaMs: Date.now() - started,
          filasSku: [],
          errorCode: "tool_desconocida",
          result: { error: "tool_desconocida" },
        };
    }

    const errorCode =
      result &&
      typeof result === "object" &&
      "error" in result &&
      typeof (result as { error: unknown }).error === "string"
        ? (result as { error: string }).error
        : null;

    return {
      name,
      ok: errorCode == null,
      latenciaMs: Date.now() - started,
      filasSku: extractSkus(result),
      errorCode,
      result,
    };
  }
}

function extractSkus(result: unknown): string[] {
  if (!result || typeof result !== "object") return [];
  const r = result as Record<string, unknown>;
  if (typeof r.sku === "string") return [r.sku];
  if (Array.isArray(result)) {
    return result
      .map((item) =>
        item && typeof item === "object" && "sku" in item
          ? String((item as { sku: unknown }).sku)
          : null,
      )
      .filter((s): s is string => !!s);
  }
  if (Array.isArray(r.items)) {
    return (r.items as unknown[])
      .map((item) =>
        item && typeof item === "object" && "sku" in item
          ? String((item as { sku: unknown }).sku)
          : null,
      )
      .filter((s): s is string => !!s);
  }
  return [];
}
