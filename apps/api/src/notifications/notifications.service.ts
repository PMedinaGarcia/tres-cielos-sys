import { Injectable, Logger, Optional } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AsesorAlertService, type AvisoCorreo } from "./asesor-alert.service";

export interface NotificacionRecord {
  id: string;
  tipo: "escalacion" | "calificado" | "listo_para_cotizar" | "asignacion";
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

  constructor(@Optional() private readonly alertas?: AsesorAlertService) {}

  async notifyEscalacion(input: {
    conversacionId: string;
    motivo: string;
    ventanaMinutos?: number;
    asesorId?: string;
    oportunidadId?: string;
    canal?: string;
    externalMessageId?: string;
    texto?: string;
    sandbox?: boolean;
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
    this.dispararCorreo({
      conversacionId: input.conversacionId,
      canal: input.canal,
      externalMessageId: input.externalMessageId,
      texto: input.texto,
      motivo: input.motivo,
      sandbox: input.sandbox,
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
    canal?: string;
    externalMessageId?: string;
    texto?: string;
    sandbox?: boolean;
  }): Promise<NotificacionRecord> {
    const n = this.create({
      tipo: input.listoParaCotizar ? "listo_para_cotizar" : "calificado",
      conversacionId: input.conversacionId,
      oportunidadId: input.oportunidadId,
      asesorId: input.asesorId,
      ventanaMinutos: 30,
    });
    this.dispararCorreo({
      conversacionId: input.conversacionId,
      canal: input.canal,
      externalMessageId: input.externalMessageId,
      texto: input.texto,
      motivo: input.listoParaCotizar ? "listo_para_cotizar" : "calificado",
      sandbox: input.sandbox,
    });
    return n;
  }

  /** Aviso de panel al dueño recién elegido. El correo lo manda AsesorAlertService. */
  notifyAsignacion(input: {
    conversacionId: string;
    oportunidadId?: string;
    asesorId: string;
    motivo?: string;
  }): NotificacionRecord {
    return this.create({
      tipo: "asignacion",
      conversacionId: input.conversacionId,
      oportunidadId: input.oportunidadId,
      asesorId: input.asesorId,
      motivo: input.motivo,
      ventanaMinutos: 30,
    });
  }

  /** Mensaje entrante con el hilo ya en manos de un asesor. No crea alerta de panel. */
  avisarMensajeEntrante(input: AvisoCorreo): void {
    this.dispararCorreo(input);
  }

  private dispararCorreo(input: AvisoCorreo): void {
    if (!this.alertas) return;
    void this.alertas.avisar(input).catch((err) => {
      this.logger.error(
        `Aviso por correo falló conv=${input.conversacionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
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
