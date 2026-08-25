import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";

export interface NotificacionRecord {
  id: string;
  tipo: "escalacion" | "calificado" | "listo_para_cotizar";
  conversacionId: string;
  oportunidadId?: string;
  asesorId?: string;
  motivo?: string;
  /** SLA ventana 15–30 min */
  vencimientoSlaEn: string;
  estado: "pendiente" | "leida" | "atendida";
  canalEntrega: "panel" | "email";
  creadoEn: string;
}

/**
 * F4 — notificación escalación (ventana 15–30 min) + calificado.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly items: NotificacionRecord[] = [];

  async notifyEscalacion(input: {
    conversacionId: string;
    motivo: string;
    ventanaMinutos?: number;
    asesorId?: string;
    oportunidadId?: string;
  }): Promise<NotificacionRecord> {
    const mins = clamp(input.ventanaMinutos ?? 20, 15, 30);
    const n = this.create({
      tipo: "escalacion",
      conversacionId: input.conversacionId,
      motivo: input.motivo,
      asesorId: input.asesorId,
      oportunidadId: input.oportunidadId,
      ventanaMinutos: mins,
    });
    this.logger.log(
      `escalación conv=${input.conversacionId} sla=${mins}m asesor=${input.asesorId ?? "-"}`,
    );
    return n;
  }

  async notifyCalificado(input: {
    conversacionId: string;
    oportunidadId: string;
    asesorId?: string;
    listoParaCotizar: boolean;
  }): Promise<NotificacionRecord> {
    return this.create({
      tipo: input.listoParaCotizar ? "listo_para_cotizar" : "calificado",
      conversacionId: input.conversacionId,
      oportunidadId: input.oportunidadId,
      asesorId: input.asesorId,
      ventanaMinutos: 30,
    });
  }

  private create(input: {
    tipo: NotificacionRecord["tipo"];
    conversacionId: string;
    oportunidadId?: string;
    asesorId?: string;
    motivo?: string;
    ventanaMinutos: number;
  }): NotificacionRecord {
    const creadoEn = new Date();
    const venc = new Date(creadoEn.getTime() + input.ventanaMinutos * 60_000);
    const n: NotificacionRecord = {
      id: randomUUID(),
      tipo: input.tipo,
      conversacionId: input.conversacionId,
      oportunidadId: input.oportunidadId,
      asesorId: input.asesorId,
      motivo: input.motivo,
      vencimientoSlaEn: venc.toISOString(),
      estado: "pendiente",
      canalEntrega: "panel",
      creadoEn: creadoEn.toISOString(),
    };
    this.items.push(n);
    return n;
  }

  pending(): NotificacionRecord[] {
    return this.items.filter((i) => i.estado === "pendiente");
  }

  clear(): void {
    this.items.length = 0;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
