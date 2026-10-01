import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import type { Conversacion, Mensaje } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  initialPasoGuion,
  isV2Plus,
  mapPasoGuionV1ToV2,
  resolveConversationFlow,
} from "../conversation-flow";
import type {
  CamposCapturados,
  ColaAsesor,
  ConversacionState,
  EstadoBot,
  GuionVersion,
  MensajeRecord,
  MotivoHandoff,
  PasoGuion,
  RutaOrquestador,
} from "../types";
import { resolveTelefonoCanal } from "../telefono";
import { mapCanalCrm } from "../../crm/cliente-identity";

/**
 * Store in-memory de Conversacion/Mensaje.
 * Si Prisma tiene el hilo, se hidrata al resolver (sobrevive un restart del API).
 */
@Injectable()
export class ConversationStoreService {
  private readonly logger = new Logger(ConversationStoreService.name);
  private readonly byKey = new Map<string, ConversacionState>();
  private readonly byId = new Map<string, ConversacionState>();

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

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

    const hydrated = await this.hydrateFromPrisma(input.canal, input.externalThreadId);
    if (hydrated) {
      if (telefono && !hydrated.camposCapturados.telefono) {
        hydrated.camposCapturados = {
          ...hydrated.camposCapturados,
          telefono,
        };
      }
      this.byKey.set(k, hydrated);
      this.byId.set(hydrated.id, hydrated);
      return hydrated;
    }

    const flow = resolveConversationFlow(this.config, {
      threadId: input.externalThreadId,
    });
    const now = new Date().toISOString();
    const campos: CamposCapturados = {
      nombre: null,
      telefono,
      ...(isV2Plus(flow) || flow === "v4" ? { tipoEvento: "boda" } : {}),
    };
    const state: ConversacionState = {
      id: randomUUID(),
      canal: input.canal,
      externalThreadId: input.externalThreadId,
      estadoBot: "activo",
      pasoGuion: initialPasoGuion(flow),
      camposCapturados: campos,
      paqueteTentativoId: null,
      ultimaRuta: null,
      motivoHandoff: null,
      escaladoEn: null,
      oportunidadId: randomUUID(),
      brief: { version: 1, actualizadoPor: "bot" },
      calificado: false,
      listoParaCotizar: false,
      guionVersion: flow,
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
    const mem = this.byId.get(id);
    if (mem) return mem;
    const hydrated = await this.hydrateFromPrismaById(id);
    if (hydrated) {
      this.byId.set(hydrated.id, hydrated);
      this.byKey.set(this.key(hydrated.canal, hydrated.externalThreadId), hydrated);
      return hydrated;
    }
    return null;
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
    guionVersion: GuionVersion | null;
    asesorLockId: string | null;
    slaVenceEn: string | null;
    cola: ColaAsesor | null;
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

  private async hydrateFromPrisma(
    canal: string,
    externalThreadId: string,
  ): Promise<ConversacionState | null> {
    if (!this.prisma || !process.env.DATABASE_URL) return null;
    try {
      const prismaCanal = mapCanalCrm(canal);
      const row = await this.prisma.conversacion.findUnique({
        where: {
          canal_externalThreadId: {
            canal: prismaCanal,
            externalThreadId,
          },
        },
        include: {
          mensajes: { orderBy: { creadoEn: "asc" } },
          oportunidad: true,
        },
      });
      if (!row) {
        if (prismaCanal === "facebook" && canal === "messenger") {
          return null;
        }
        return null;
      }
      return this.toState(row, canal);
    } catch (err) {
      this.logger.warn(
        `No se pudo hidratar conversación ${canal}/${externalThreadId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  private async hydrateFromPrismaById(
    id: string,
  ): Promise<ConversacionState | null> {
    if (!this.prisma || !process.env.DATABASE_URL) return null;
    try {
      const row = await this.prisma.conversacion.findUnique({
        where: { id },
        include: {
          mensajes: { orderBy: { creadoEn: "asc" } },
          oportunidad: true,
        },
      });
      if (!row) return null;
      return this.toState(row, String(row.canal));
    } catch (err) {
      this.logger.warn(
        `No se pudo hidratar conversación ${id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  private toState(
    row: Conversacion & {
      mensajes: Mensaje[];
      oportunidad?: {
        calificacion?: string;
        listoParaCotizar?: boolean;
        briefJson?: unknown;
      } | null;
    },
    canalInbound: string,
  ): ConversacionState {
    const extra = row as Conversacion & {
      guionVersion?: string | null;
      asesorLockId?: string | null;
      slaVenceEn?: Date | null;
      cola?: string | null;
    };
    const flow = resolveConversationFlow(this.config, {
      threadId: row.externalThreadId ?? "",
      persisted: extra.guionVersion,
    });
    const paso = isV2Plus(flow)
      ? mapPasoGuionV1ToV2(row.pasoGuion as PasoGuion)
      : (row.pasoGuion as PasoGuion);
    const campos = camposFromJson(row.camposCapturados);
    if (row.encajeEconomico && !campos.encajeEconomico) {
      campos.encajeEconomico = row.encajeEconomico;
    }
    if (row.rutaComercial && !campos.rutaComercial) {
      campos.rutaComercial = row.rutaComercial;
    }
    const opp = row.oportunidad;
    const brief =
      opp?.briefJson && typeof opp.briefJson === "object" && !Array.isArray(opp.briefJson)
        ? (opp.briefJson as Record<string, unknown>)
        : { version: 1, actualizadoPor: "bot" };
    return {
      id: row.id,
      canal: canalInbound,
      externalThreadId: row.externalThreadId ?? "",
      estadoBot: row.estadoBot,
      pasoGuion: paso,
      camposCapturados: campos,
      paqueteTentativoId: row.paqueteTentativoId,
      ultimaRuta: row.ultimaRuta,
      motivoHandoff: row.motivoHandoff,
      escaladoEn: row.escaladoEn?.toISOString() ?? null,
      oportunidadId: row.oportunidadId,
      brief,
      calificado: opp?.calificacion === "calificado",
      listoParaCotizar: Boolean(opp?.listoParaCotizar),
      pedidoCotizacion: null,
      pedidoCotizacionFuente: null,
      mensajes: row.mensajes.map(mensajeFromPrisma),
      creadoEn: row.creadoEn.toISOString(),
      actualizadoEn: row.actualizadoEn.toISOString(),
      guionVersion: (extra.guionVersion as GuionVersion | null) ?? flow,
      asesorLockId: extra.asesorLockId ?? null,
      slaVenceEn: extra.slaVenceEn?.toISOString() ?? null,
      cola: (extra.cola as ColaAsesor | null) ?? null,
    };
  }
}

function camposFromJson(json: unknown): CamposCapturados {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  return { ...(json as CamposCapturados) };
}

function mensajeFromPrisma(row: Mensaje): MensajeRecord {
  return {
    id: row.id,
    direccion: row.direccion,
    autor: row.autor,
    contenido: row.contenido,
    timestamp: row.creadoEn.toISOString(),
    externalMessageId: row.externalMessageId ?? undefined,
    ruta: row.ruta ?? undefined,
    consumioCupo: row.consumeCupo,
    plantillaUtilityId: row.plantillaUtilityId,
  };
}
