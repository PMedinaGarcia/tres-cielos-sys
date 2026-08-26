import { Injectable, Logger, Optional } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { ActorOperativo, Prisma, TipoInteraccion } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type ActorOperativoAudit =
  | "bot"
  | "asesor"
  | "coordinador"
  | "admin"
  | "sistema";

export interface EventoOperativoRecord {
  id: string;
  tipo: string;
  actor: ActorOperativoAudit;
  timestamp: string;
  sedeId?: string;
  oportunidadId?: string;
  conversacionId?: string;
  mensajeId?: string;
  clienteId?: string;
  payload: Record<string, unknown>;
}

/**
 * Persistencia EventoOperativo + Interaccion CRM.
 * Sin DATABASE_URL mantiene el buffer in-memory (tests / sandbox).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly events: EventoOperativoRecord[] = [];

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async record(input: {
    tipo: string;
    actor: ActorOperativoAudit;
    sedeId?: string;
    oportunidadId?: string;
    conversacionId?: string;
    mensajeId?: string;
    payload?: Record<string, unknown>;
  }): Promise<EventoOperativoRecord> {
    const evt: EventoOperativoRecord = {
      id: randomUUID(),
      tipo: input.tipo,
      actor: input.actor,
      timestamp: new Date().toISOString(),
      sedeId: input.sedeId,
      oportunidadId: input.oportunidadId,
      conversacionId: input.conversacionId,
      mensajeId: input.mensajeId,
      payload: input.payload ?? {},
    };
    this.events.push(evt);

    if (this.prisma && process.env.DATABASE_URL) {
      try {
        await this.persist(evt);
      } catch (err) {
        this.logger.warn(
          `No se persistió EventoOperativo ${evt.tipo}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return evt;
  }

  listByConversacion(conversacionId: string): EventoOperativoRecord[] {
    return this.events.filter((e) => e.conversacionId === conversacionId);
  }

  all(): EventoOperativoRecord[] {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
  }

  private async persist(evt: EventoOperativoRecord): Promise<void> {
    const prisma = this.prisma!;
    let clienteId: string | undefined;
    let oportunidadId = evt.oportunidadId;
    let conversacionId = evt.conversacionId;
    let mensajeId = evt.mensajeId;

    if (conversacionId) {
      const conv = await prisma.conversacion.findUnique({
        where: { id: conversacionId },
        select: { clienteId: true, oportunidadId: true },
      });
      if (conv) {
        clienteId = conv.clienteId;
        oportunidadId = oportunidadId ?? conv.oportunidadId;
      } else {
        conversacionId = undefined;
      }
    }
    if (!clienteId && oportunidadId) {
      const opp = await prisma.oportunidad.findUnique({
        where: { id: oportunidadId },
        select: { clienteId: true },
      });
      if (opp) clienteId = opp.clienteId;
      else oportunidadId = undefined;
    }
    if (mensajeId) {
      const msg = await prisma.mensaje.findUnique({
        where: { id: mensajeId },
        select: { id: true },
      });
      if (!msg) mensajeId = undefined;
    }

    await prisma.eventoOperativo.create({
      data: {
        id: evt.id,
        tipo: evt.tipo,
        actor: evt.actor as ActorOperativo,
        payload: evt.payload as Prisma.InputJsonValue,
        clienteId: clienteId ?? null,
        oportunidadId: oportunidadId ?? null,
        conversacionId: conversacionId ?? null,
        mensajeId: mensajeId ?? null,
        sede: evt.sedeId ?? null,
        creadoEn: new Date(evt.timestamp),
      },
    });

    if (!clienteId) return;

    await prisma.interaccion.create({
      data: {
        clienteId,
        oportunidadId: oportunidadId ?? null,
        conversacionId: conversacionId ?? null,
        mensajeId: mensajeId ?? null,
        eventoOperativoId: evt.id,
        tipo: mapAuditTipo(evt.tipo),
        actor: evt.actor as ActorOperativo,
        resumen: resumenAudit(evt.tipo, evt.payload),
        payload: evt.payload as Prisma.InputJsonValue,
      },
    });
  }
}

function mapAuditTipo(tipo: string): TipoInteraccion {
  if (tipo === "bot_handoff") return "handoff";
  if (tipo === "toma_control") return "toma_control";
  if (tipo.includes("etapa")) return "cambio_etapa";
  if (tipo.includes("asign")) return "asignacion";
  return "accion_bot";
}

function resumenAudit(tipo: string, payload: Record<string, unknown>): string {
  if (tipo === "bot_handoff") {
    return `Handoff (${String(payload.motivoHandoff ?? "otro")})`;
  }
  if (tipo === "toma_control") return "Toma de control";
  return tipo.replace(/_/g, " ");
}
