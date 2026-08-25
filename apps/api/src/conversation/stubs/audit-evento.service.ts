import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { EventoOperativoRecord } from "../types";

/**
 * Audit local — persiste EventoOperativo en memoria.
 * Cuando Prisma tenga el modelo, otro agente puede reemplazar este stub.
 */
@Injectable()
export class AuditEventoService {
  private readonly events = new Map<string, EventoOperativoRecord>();

  async emit(input: {
    tipo: string;
    actor?: "bot" | "sistema";
    conversacionId: string;
    mensajeId?: string;
    oportunidadId?: string;
    payload: Record<string, unknown>;
  }): Promise<EventoOperativoRecord> {
    const row: EventoOperativoRecord = {
      id: randomUUID(),
      tipo: input.tipo,
      actor: input.actor ?? "bot",
      timestamp: new Date().toISOString(),
      conversacionId: input.conversacionId,
      mensajeId: input.mensajeId,
      oportunidadId: input.oportunidadId,
      payload: input.payload,
    };
    this.events.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<EventoOperativoRecord | null> {
    return this.events.get(id) ?? null;
  }

  listByConversacion(conversacionId: string): EventoOperativoRecord[] {
    return [...this.events.values()].filter(
      (e) => e.conversacionId === conversacionId,
    );
  }

  clear(): void {
    this.events.clear();
  }
}
