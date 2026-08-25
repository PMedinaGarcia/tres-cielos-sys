import { Injectable } from "@nestjs/common";
import type { Canal, EstadoBot } from "./types/inbound-message";

export interface ConversacionState {
  id: string;
  canal: Canal;
  externalThreadId: string;
  estadoBot: EstadoBot;
  oportunidadId?: string;
  sedeId?: string;
  asesorId?: string;
}

/**
 * Estado conversacional mínimo in-memory (Fase A → Prisma Conversacion).
 * Campos esperados: id, canal, external_thread_id, estado_bot, oportunidad_id,
 * paso_guion, campos_capturados, escalado_en, motivo_handoff.
 */
@Injectable()
export class ConversationStateStore {
  private readonly byThread = new Map<string, ConversacionState>();

  private key(canal: Canal, externalThreadId: string): string {
    return `${canal}::${externalThreadId}`;
  }

  getOrCreate(canal: Canal, externalThreadId: string): ConversacionState {
    const k = this.key(canal, externalThreadId);
    let c = this.byThread.get(k);
    if (!c) {
      c = {
        id: `conv_${k}`,
        canal,
        externalThreadId,
        estadoBot: "activo",
      };
      this.byThread.set(k, c);
    }
    return c;
  }

  getById(id: string): ConversacionState | undefined {
    for (const c of this.byThread.values()) {
      if (c.id === id) return c;
    }
    return undefined;
  }

  setEstadoBot(id: string, estadoBot: EstadoBot): ConversacionState {
    const c = this.getById(id);
    if (!c) throw new Error(`CONVERSACION_NOT_FOUND:${id}`);
    c.estadoBot = estadoBot;
    return c;
  }

  clear(): void {
    this.byThread.clear();
  }
}
