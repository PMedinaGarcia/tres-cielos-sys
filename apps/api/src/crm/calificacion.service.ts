import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

export interface BriefCotizacionStub {
  tipoEvento?: string;
  fechaTentativa?: unknown;
  aforo?: number;
  sedeId?: string;
  paquete?: { modo: "sku" | "a_medida"; sku?: string };
  presupuestoOrientativo?:
    | { tipo: "rango"; min?: number; max?: number; moneda: "MXN" }
    | { tipo: "no_definido" };
  contacto?: { nombre?: string; telefono?: string };
}

export interface OportunidadStub {
  id: string;
  clienteId: string;
  calificacion: "calificado" | "en_exploracion";
  listoParaCotizar: boolean;
  brief: BriefCotizacionStub;
  sedeId?: string;
  conversacionId?: string;
}

/**
 * F4 — Cliente/Opp brief, calificado, listo_para_cotizar.
 * Persistencia stub; campos Prisma esperados:
 * Cliente(id, nombre, telefono, correo, identificadores)
 * Oportunidad(id, cliente_id, calificacion, listo_para_cotizar, etapa, sede_id, brief json)
 */
@Injectable()
export class CrmCalificacionService {
  private readonly oportunidades = new Map<string, OportunidadStub>();
  private readonly byConversacion = new Map<string, string>();

  /** Brief de prueba inyectable por conversación */
  private readonly briefs = new Map<string, BriefCotizacionStub>();

  setBrief(conversacionId: string, brief: BriefCotizacionStub): void {
    this.briefs.set(conversacionId, brief);
  }

  evaluarTrasTurno(input: {
    conversacionId: string;
    oportunidadId?: string;
    sedeId?: string;
  }): {
    oportunidadId: string;
    calificacion: "calificado" | "en_exploracion";
    listoParaCotizar: boolean;
  } {
    const brief =
      this.briefs.get(input.conversacionId) ??
      this.defaultBrief(input.sedeId);

    const calificado = this.isCalificado(brief);
    const listo = calificado && this.isListoParaCotizar(brief);

    let oppId =
      input.oportunidadId ?? this.byConversacion.get(input.conversacionId);
    if (!oppId) {
      oppId = randomUUID();
      this.byConversacion.set(input.conversacionId, oppId);
    }

    const opp: OportunidadStub = {
      id: oppId,
      clienteId: `cliente-${input.conversacionId}`,
      calificacion: calificado ? "calificado" : "en_exploracion",
      listoParaCotizar: listo,
      brief,
      sedeId: input.sedeId ?? brief.sedeId,
      conversacionId: input.conversacionId,
    };
    this.oportunidades.set(oppId, opp);
    return {
      oportunidadId: oppId,
      calificacion: opp.calificacion,
      listoParaCotizar: opp.listoParaCotizar,
    };
  }

  isCalificado(brief: BriefCotizacionStub): boolean {
    return Boolean(
      brief.tipoEvento &&
        brief.fechaTentativa &&
        brief.aforo &&
        brief.sedeId &&
        brief.contacto?.nombre,
    );
  }

  isListoParaCotizar(brief: BriefCotizacionStub): boolean {
    if (!this.isCalificado(brief)) return false;
    if (!brief.paquete) return false;
    if (!brief.contacto?.nombre) return false;
    return true;
  }

  private defaultBrief(sedeId?: string): BriefCotizacionStub {
    return {
      sedeId,
    };
  }

  get(oportunidadId: string): OportunidadStub | undefined {
    return this.oportunidades.get(oportunidadId);
  }

  clear(): void {
    this.oportunidades.clear();
    this.byConversacion.clear();
    this.briefs.clear();
  }
}
