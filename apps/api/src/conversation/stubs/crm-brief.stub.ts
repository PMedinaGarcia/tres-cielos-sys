import { Injectable } from "@nestjs/common";
import type { CamposCapturados, ConversacionState } from "../types";

@Injectable()
export class CrmBriefStubService {
  evalCalificacion(campos: CamposCapturados): {
    calificado: boolean;
    listoParaCotizar: boolean;
  } {
    const calificado = Boolean(
      campos.nombre &&
        campos.tipoEvento &&
        campos.fechaTentativa &&
        campos.aforo != null &&
        (campos.sedeId || campos.sedeNombre) &&
        campos.intencionCotizar === true,
    );
    return {
      calificado,
      listoParaCotizar: false, // requiere paquete — se evalúa en applyAfterTurn
    };
  }

  async applyAfterTurn(
    conv: ConversacionState,
    extras?: {
      paqueteTentativoId?: string | null;
      precioSnapshot?: Record<string, unknown> | null;
      registroConsultaCatalogoId?: string | null;
      consultaCatalogo?: {
        id: string;
        tool: string;
        input: Record<string, unknown>;
        filasSku: string[];
        ok: boolean;
        creadoEn: string;
      } | null;
    },
  ): Promise<{
    calificado: boolean;
    listoParaCotizar: boolean;
    brief: Record<string, unknown>;
  }> {
    const { calificado } = this.evalCalificacion(conv.camposCapturados);
    const hasPaquete = Boolean(
      extras?.paqueteTentativoId ?? conv.paqueteTentativoId,
    );
    const listoParaCotizar = calificado && hasPaquete;

    const brief: Record<string, unknown> = {
      ...conv.brief,
      version: Number(conv.brief.version ?? 1) + 1,
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: "bot",
      tipoEvento: conv.camposCapturados.tipoEvento ?? null,
      fechaTentativa: conv.camposCapturados.fechaTentativa ?? null,
      aforo: conv.camposCapturados.aforo ?? null,
      sedeId: conv.camposCapturados.sedeId ?? null,
      sedeNombre: conv.camposCapturados.sedeNombre ?? null,
      presupuestoOrientativo:
        conv.camposCapturados.presupuestoOrientativo ?? null,
      contacto: {
        nombre: conv.camposCapturados.nombre ?? null,
        telefono: conv.camposCapturados.telefono ?? null,
        canalRespuesta: conv.canal,
      },
      listoParaCotizar,
      ...(hasPaquete
        ? {
            paquete: {
              modo: "sku",
              paqueteId: extras?.paqueteTentativoId ?? conv.paqueteTentativoId,
            },
          }
        : {}),
      ...(extras?.precioSnapshot
        ? { precioCatalogoAlMomento: extras.precioSnapshot }
        : {}),
      ...(extras?.consultaCatalogo
        ? { consultaCatalogoAlMomento: extras.consultaCatalogo }
        : {}),
      fuentes: {
        registroConsultaCatalogoIds: extras?.registroConsultaCatalogoId
          ? [extras.registroConsultaCatalogoId]
          : ((conv.brief.fuentes as { registroConsultaCatalogoIds?: string[] })
              ?.registroConsultaCatalogoIds ?? []),
      },
    };

    return { calificado, listoParaCotizar, brief };
  }
}
