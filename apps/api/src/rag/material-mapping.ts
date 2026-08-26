import type {
  EstadoDocumento,
  OrigenDerivacion,
  PipelineEstado,
  TipoMaterial as RagTipoMaterial,
} from "./types";
import type { TipoMaterial as PrismaTipoMaterial } from "../knowledge-ingestion/contracts/media.types";

export function mimeToPrismaTipoMaterial(mime: string): PrismaTipoMaterial {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("word") || mime.includes("msword")) return "docx";
  if (mime.includes("sheet") || mime.includes("excel")) return "xlsx";
  if (mime.includes("csv")) return "csv";
  if (mime.startsWith("image/")) return "imagen";
  if (mime.startsWith("video/")) return "video";
  return "pdf";
}

export function toRagTipoMaterial(
  tipoDocumento?: string | null,
  tipoMaterial?: string | null,
): RagTipoMaterial {
  if (tipoDocumento === "faq" || tipoDocumento === "safe_reply") return "faq";
  if (tipoDocumento === "tipos_evento") return "faq";
  switch (tipoMaterial) {
    case "docx":
    case "word":
      return "word";
    case "imagen":
    case "foto":
      return "foto";
    case "xlsx":
    case "csv":
    case "xls":
      return "xls";
    case "pdf":
      return "pdf";
    case "video":
      return "video";
    case "faq":
      return "faq";
    default:
      return "otro";
  }
}

export function toPrismaTipoMaterial(
  t: string,
): PrismaTipoMaterial {
  switch (t) {
    case "word":
    case "docx":
      return "docx";
    case "foto":
    case "imagen":
      return "imagen";
    case "xls":
    case "xlsx":
      return "xlsx";
    case "csv":
      return "csv";
    case "video":
      return "video";
    case "pdf":
    default:
      return "pdf";
  }
}

export function toOrigenDerivacion(o: string): OrigenDerivacion {
  if (
    o === "nativo" ||
    o === "texto_nativo" ||
    o === "vision" ||
    o === "whisper" ||
    o === "xls_narrativo"
  ) {
    return o;
  }
  return "texto_nativo";
}

export function toPrismaOrigen(
  o: string,
): "texto_nativo" | "vision" | "whisper" | "xls_narrativo" {
  const mapped = toOrigenDerivacion(o);
  if (mapped === "nativo") return "texto_nativo";
  return mapped;
}

export function inventarioToTipoDocumento(
  inventarioId?: string,
): "faq" | "ficha_sede" | "politica" | "tipos_evento" | "safe_reply" | "otro" {
  switch (inventarioId?.toUpperCase()) {
    case "K01":
    case "K08":
      return "faq";
    case "K02":
    case "K03":
      return "ficha_sede";
    case "K04":
      return "tipos_evento";
    case "K06":
    case "K07":
    case "K14":
      return "politica";
    case "K09":
      return "safe_reply";
    default:
      return "otro";
  }
}

export function toEstadoDocumento(estado: string): EstadoDocumento {
  if (estado === "borrador" || estado === "publicado" || estado === "archivado") {
    return estado;
  }
  return "borrador";
}

export function toPipelineEstado(estado: string): PipelineEstado {
  if (
    estado === "pendiente" ||
    estado === "procesando" ||
    estado === "listo" ||
    estado === "error" ||
    estado === "fallido"
  ) {
    return estado;
  }
  if (estado === "parcial") return "listo";
  return "pendiente";
}

export function parsePgVector(text: string | null | undefined): number[] {
  if (!text) return [];
  const inner = text.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (!inner) return [];
  return inner.split(",").map((n) => Number(n.trim()));
}

export function toPgVectorLiteral(embedding: number[]): string {
  const nums = embedding.map((n) => {
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  });
  return `[${nums.join(",")}]`;
}
