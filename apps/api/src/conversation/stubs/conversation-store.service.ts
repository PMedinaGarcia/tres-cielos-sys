import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  CamposCapturados,
  ConversacionState,
  EstadoBot,
  MensajeRecord,
  MotivoHandoff,
  PasoGuion,
  RutaOrquestador,
} from "../types";
import { resolveTelefonoCanal } from "../telefono";

/**
 * Store in-memory de Conversacion/Mensaje.
 * Fase A (otro agente) reemplazará por Prisma cuando exista schema.
 */
@Injectable()
export class ConversationStoreService {
  private readonly byKey = new Map<string, ConversacionState>();
  private readonly byId = new Map<string, ConversacionState>();

  private key(canal: string, externalThreadId: string): string {
    return `${canal}::${externalThreadId}`;
  }

  async resolveOrCreate(input: {
    canal: string;
    externalThreadId: string;
    perfilNombre?: string | null;
    perfilWaId?: string | null;
  }): Promise<ConversacionState> {
    const k = this.key(input.canal, input.externalThreadId);
    const existing = this.byKey.get(k);
    const telefono = resolveTelefonoCanal({
      waId: input.perfilWaId,
      externalThreadId: input.externalThreadId,
    });
    if (existing) {
      if (telefono && !existing.camposCapturados.telefono) {
        existing.camposCapturados = {
          ...existing.camposCapturados,
          telefono,
        };
        existing.actualizadoEn = new Date().toISOString();
      }
      return existing;
    }

    const now = new Date().toISOString();
    const campos: CamposCapturados = {
      nombre: null,
      telefono,
    };
    const state: ConversacionState = {
      id: randomUUID(),
      canal: input.canal,
      externalThreadId: input.externalThreadId,
      estadoBot: "activo",
      pasoGuion: "saludo",
      camposCapturados: campos,
      paqueteTentativoId: null,
      ultimaRuta: null,
      motivoHandoff: null,
      escaladoEn: null,
      oportunidadId: randomUUID(),
      brief: { version: 1, actualizadoPor: "bot" },
      calificado: false,
      listoParaCotizar: false,
      pedidoCotizacion: null,
      pedidoCotizacionFuente: null,
      mensajes: [],
      creadoEn: now,
      actualizadoEn: now,
    };
    this.byKey.set(k, state);
    this.byId.set(state.id, state);
    return state;
  }

  async findById(id: string): Promise<ConversacionState | null> {
    return this.byId.get(id) ?? null;
  }

  async appendMensaje(
    conversacionId: string,
    mensaje: Omit<MensajeRecord, "id"> & { id?: string },
  ): Promise<MensajeRecord> {
    const conv = this.byId.get(conversacionId);
    if (!conv) throw new Error(`conversacion ${conversacionId} no encontrada`);
    const row: MensajeRecord = {
      ...mensaje,
      id: mensaje.id ?? randomUUID(),
    };
    conv.mensajes.push(row);
    conv.actualizadoEn = new Date().toISOString();
    return row;
  }

  async update(conversacionId: string, patch: Partial<{
    estadoBot: EstadoBot;
    pasoGuion: PasoGuion;
    camposCapturados: CamposCapturados;
    paqueteTentativoId: string | null;
    ultimaRuta: RutaOrquestador | null;
    motivoHandoff: MotivoHandoff | null;
    escaladoEn: string | null;
    brief: Record<string, unknown>;
    calificado: boolean;
    listoParaCotizar: boolean;
    pedidoCotizacion: boolean | null;
    pedidoCotizacionFuente: string | null;
  }>): Promise<ConversacionState> {
    const conv = this.byId.get(conversacionId);
    if (!conv) throw new Error(`conversacion ${conversacionId} no encontrada`);
    Object.assign(conv, patch, { actualizadoEn: new Date().toISOString() });
    return conv;
  }

  clear(): void {
    this.byKey.clear();
    this.byId.clear();
  }
}
