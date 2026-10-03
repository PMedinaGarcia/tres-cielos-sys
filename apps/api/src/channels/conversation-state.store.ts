import { Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { mapCanalCrm } from "../crm/cliente-identity";
import { ClienteMemoriaService } from "../conversation/memoria/cliente-memoria.service";
import type { Canal, EstadoBot } from "./types/inbound-message";

export interface ConversacionState {
  id: string;
  canal: Canal;
  externalThreadId: string;
  estadoBot: EstadoBot;
  oportunidadId?: string;
  sedeId?: string;
  asesorId?: string;
  asesorLockId?: string | null;
  cola?: "comercial" | "atencion_general" | null;
}

/**
 * Estado conversacional mínimo in-memory (Fase A → Prisma Conversacion).
 * Campos esperados: id, canal, external_thread_id, estado_bot, oportunidad_id,
 * paso_guion, campos_capturados, escalado_en, motivo_handoff.
 */
@Injectable()
export class ConversationStateStore {
  private readonly byThread = new Map<string, ConversacionState>();

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly memoria?: ClienteMemoriaService,
  ) {}

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

  async overlayFromPrisma(
    canal: Canal,
    externalThreadId: string,
  ): Promise<ConversacionState> {
    const mem = this.getOrCreate(canal, externalThreadId);
    const perfil = await this.memoria?.buscarEstado(canal, externalThreadId);
    if (perfil) {
      mem.estadoBot = perfil.estadoBot;
      mem.oportunidadId = perfil.oportunidadId ?? mem.oportunidadId;
      if (perfil.cola) mem.cola = perfil.cola;
    }
    if (!this.prisma || !process.env.DATABASE_URL) return mem;
    try {
      const row = await this.prisma.conversacion.findUnique({
        where: {
          canal_externalThreadId: {
            canal: mapCanalCrm(canal),
            externalThreadId,
          },
        },
      });
      if (!row) return mem;
      mem.id = row.id;
      if (!perfil) mem.estadoBot = row.estadoBot;
      mem.asesorLockId =
        (row as { asesorLockId?: string | null }).asesorLockId ?? null;
      const cola = (row as { cola?: string | null }).cola;
      mem.cola =
        cola === "atencion_general" || cola === "comercial" ? cola : null;
      return mem;
    } catch {
      return mem;
    }
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
