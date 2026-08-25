import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

export type ActorOperativo =
  | "bot"
  | "asesor"
  | "coordinador"
  | "admin"
  | "sistema";

export interface EventoOperativoRecord {
  id: string;
  tipo: string;
  actor: ActorOperativo;
  timestamp: string;
  sedeId?: string;
  oportunidadId?: string;
  conversacionId?: string;
  mensajeId?: string;
  payload: Record<string, unknown>;
}

/**
 * Persistencia EventoOperativo — stub in-memory hasta Prisma Fase A.
 * Campos esperados: id, tipo, actor, timestamp, sede_id?, oportunidad_id?,
 * conversacion_id?, mensaje_id?, payload (json).
 */
@Injectable()
export class AuditService {
  private readonly events: EventoOperativoRecord[] = [];

  async record(input: {
    tipo: string;
    actor: ActorOperativo;
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
}
