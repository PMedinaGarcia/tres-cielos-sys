import { Injectable } from "@nestjs/common";
import {
  SAFE_COPY_HANDOFF_HUMANO,
  SAFE_COPY_K09,
} from "./safe-copy";
import type { MotivoHandoff } from "../types";
import { ConversationStoreService } from "../stubs/conversation-store.service";
import { AuditEventoService } from "../stubs/audit-evento.service";

export interface HandoffResult {
  estadoBot: "escalado";
  motivo: MotivoHandoff;
  safeCopy: string;
  escaladoEn: string;
  notificacion: {
    tipo: "escalacion";
    ventanaMinutos: { min: number; max: number };
    canalEntrega: ("panel" | "email")[];
  };
}

@Injectable()
export class HandoffService {
  constructor(
    private readonly store: ConversationStoreService,
    private readonly audit: AuditEventoService,
  ) {}

  safeCopyFor(motivo: MotivoHandoff): string {
    if (motivo === "solicitud_usuario") return SAFE_COPY_HANDOFF_HUMANO;
    return SAFE_COPY_K09;
  }

  async escalate(input: {
    conversacionId: string;
    motivo: MotivoHandoff;
    oportunidadId?: string;
    mensajeId?: string;
    extraPayload?: Record<string, unknown>;
    safeCopy?: string;
  }): Promise<HandoffResult> {
    const escaladoEn = new Date().toISOString();
    await this.store.update(input.conversacionId, {
      estadoBot: "escalado",
      motivoHandoff: input.motivo,
      escaladoEn,
      ultimaRuta: "handoff",
    });

    const safeCopy = input.safeCopy ?? this.safeCopyFor(input.motivo);

    await this.audit.emit({
      tipo: "bot_handoff",
      conversacionId: input.conversacionId,
      oportunidadId: input.oportunidadId,
      mensajeId: input.mensajeId,
      payload: {
        ruta: "handoff",
        motivoHandoff: input.motivo,
        notificacion: {
          tipo: "escalacion",
          ventanaMinutos: { min: 15, max: 30 },
        },
        ...input.extraPayload,
      },
    });

    return {
      estadoBot: "escalado",
      motivo: input.motivo,
      safeCopy,
      escaladoEn,
      notificacion: {
        tipo: "escalacion",
        ventanaMinutos: { min: 15, max: 30 },
        canalEntrega: ["panel", "email"],
      },
    };
  }
}
