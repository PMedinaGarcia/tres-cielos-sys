import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  ActualizarBriefRequestSchema,
  EnviarMensajeAsesorRequestSchema,
  type ActualizarBriefRequest,
  type EnviarMensajeAsesorResponse,
  type EntregaMensajeAsesor,
} from "@tres-cielos/shared";
import type { PanelUser } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { ClienteMemoriaService } from "../conversation/memoria/cliente-memoria.service";
import {
  presupuestoFromRango,
  presupuestoFromRangoPresupuestoFuera,
} from "../conversation/conversation-flow";
import { encajeDeRango } from "../conversation/script/harvest-rango";
import { isoToFechaTentativa } from "../conversation/script/fecha-tentativa.parser";
import { ConversationStoreService } from "../conversation/stubs/conversation-store.service";
import type {
  CamposCapturados,
  ColaAsesor,
  ConversacionState,
  EstadoBot,
} from "../conversation/types";
import { ExpedientePersistService } from "../crm/expediente-persist.service";
import { PrismaService } from "../prisma/prisma.service";
import { PanelRealtimeService } from "../panel-realtime/panel-realtime.service";
import { BandejaAttachmentsService } from "./bandeja-attachments.service";
import { entregaTwilioParaAdjunto } from "./bandeja-media.util";
import { ConversationStateStore } from "./conversation-state.store";
import { OutboundService } from "./outbound.service";
import type { Canal, OutboundMediaFile } from "./types/inbound-message";

const VENTANA_WHATSAPP_MS = 24 * 60 * 60 * 1000;

type HiloRow = {
  id: string;
  clienteId: string;
  oportunidadId: string;
  canal: string;
  externalThreadId: string | null;
  estadoBot: EstadoBot;
  asesorLockId: string | null;
  pasoGuion: ConversacionState["pasoGuion"];
  camposCapturados: unknown;
  paqueteTentativoId: string | null;
  ultimaRuta: ConversacionState["ultimaRuta"];
  motivoHandoff: ConversacionState["motivoHandoff"];
  escaladoEn: Date | null;
  creadoEn: Date;
  guionVersion: string | null;
  slaVenceEn: Date | null;
  cola: string | null;
  cliente: {
    id: string;
    asesorAsignadoId: string | null;
    optOutMensajeria: boolean;
    nombre: string | null;
  };
  oportunidad: {
    briefJson: unknown;
    calificacion: string;
    listoParaCotizar: boolean;
  };
  mensajes: Array<{ creadoEn: Date }>;
};

@Injectable()
export class BandejaService {
  private readonly logger = new Logger(BandejaService.name);

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly outbound?: OutboundService,
    @Optional() private readonly conversations?: ConversationStateStore,
    @Optional() private readonly orchStore?: ConversationStoreService,
    @Optional() private readonly expediente?: ExpedientePersistService,
    @Optional() private readonly audit?: AuditService,
    @Optional() private readonly memoria?: ClienteMemoriaService,
    @Optional() private readonly adjuntos?: BandejaAttachmentsService,
    @Optional() private readonly realtime?: PanelRealtimeService,
  ) {}

  async tomarControl(
    id: string,
    body: { motivo?: string },
    user: PanelUser,
  ): Promise<{ id: string; estadoBot: "humano"; eventoOperativoId: string }> {
    const conv = await this.load(id, user);
    if (conv.asesorLockId && conv.asesorLockId !== user.userId) {
      throw conflict(
        "OWNERSHIP_CONFLICT",
        "Otro asesor ya tomó este hilo",
      );
    }
    const anterior = conv.estadoBot;
    const canal = this.conversations?.getById(id);
    if (canal) this.conversations?.setEstadoBot(id, "humano");
    const orch = await this.orchStore?.findById(id);
    if (orch) {
      await this.orchStore?.update(id, {
        estadoBot: "humano",
        asesorLockId: user.userId,
      });
    }
    const evento = await this.audit?.record({
      tipo: "toma_control",
      actor: "asesor",
      conversacionId: id,
      payload: {
        estadoBotAnterior: anterior,
        estadoBotNuevo: "humano",
        usuarioId: user.userId,
        motivo: body.motivo ?? null,
      },
    });
    await this.expediente?.persistTomaControl({
      conversacionId: id,
      usuarioId: user.userId,
      motivo: body.motivo ?? null,
    });
    return {
      id,
      estadoBot: "humano",
      eventoOperativoId: evento?.id ?? "",
    };
  }

  async enviarMensaje(
    id: string,
    body: unknown,
    user: PanelUser,
  ): Promise<EnviarMensajeAsesorResponse> {
    const parsed = EnviarMensajeAsesorRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("CONTENIDO_INVALIDO");
    }
    const contenido = parsed.data.contenido?.trim() ?? "";
    const refs = parsed.data.adjuntos ?? [];
    const conv = await this.load(id, user);
    if (conv.asesorLockId && conv.asesorLockId !== user.userId) {
      throw conflict("OWNERSHIP_CONFLICT", "Otro asesor ya tomó este hilo");
    }
    if (conv.cliente.optOutMensajeria) {
      throw conflict(
        "OPT_OUT",
        "Este cliente pidió no recibir mensajes",
      );
    }
    if (this.ventanaCerrada(conv)) {
      throw conflict(
        "VENTANA_CERRADA",
        "Pasaron más de 24 h desde el último mensaje del cliente",
      );
    }

    const yaEsSuyo =
      conv.estadoBot === "humano" && conv.asesorLockId === user.userId;
    if (!yaEsSuyo) {
      await this.tomarControl(id, { motivo: "respuesta_asesor" }, user);
    }

    const archivos: OutboundMediaFile[] = [];
    const adjuntosDb: Array<{
      mimeType: string;
      nombreOriginal: string;
      storageKey: string;
      bytes: number;
    }> = [];
    if (refs.length > 0) {
      if (!this.adjuntos) throw new BadRequestException("ADJUNTOS_NO_DISPONIBLE");
      for (const ref of refs) {
        const listo = this.adjuntos.consumeForSend(conv.id, ref.uploadId, user);
        const url = await this.adjuntos.publicUrl(listo.storageKey, 3600);
        const delivery = entregaTwilioParaAdjunto({
          mimeType: listo.mimeType,
          bytes: listo.bytes,
        });
        archivos.push({
          url,
          filename: listo.nombreOriginal,
          mime: listo.mimeType,
          delivery,
        });
        adjuntosDb.push({
          mimeType: listo.mimeType,
          nombreOriginal: listo.nombreOriginal,
          storageKey: listo.storageKey,
          bytes: listo.bytes,
        });
      }
    }

    const sandbox = esHiloSandbox(conv.canal, conv.externalThreadId);
    let entrega: EntregaMensajeAsesor = sandbox ? "sandbox" : "enviado";
    let externalMessageId: string | null = null;
    if (!sandbox) {
      if (!this.outbound) {
        throw envioFallido("ENVIO_NO_CONFIGURADO");
      }
      const sent = await this.outbound.send({
        canal: canalSaliente(conv.canal),
        externalThreadId: conv.externalThreadId ?? "",
        texto: contenido,
        mediaFiles: archivos.length > 0 ? archivos : undefined,
      });
      if (!sent.ok) throw envioFallido(sent.reason ?? "ENVIO_FALLIDO");
      entrega = sent.skipped ? "omitido" : "enviado";
      externalMessageId = sent.providerMessageId ?? null;
    }

    const prisma = this.db();
    const textoGuardado =
      contenido ||
      adjuntosDb.map((a) => a.nombreOriginal).join(", ") ||
      "(adjunto)";
    const mensaje = await prisma.mensaje.create({
      data: {
        conversacionId: conv.id,
        direccion: "saliente",
        autor: "asesor",
        canal: conv.canal as Prisma.MensajeCreateInput["canal"],
        contenido: textoGuardado,
        externalMessageId,
      },
    });
    for (const adj of adjuntosDb) {
      await prisma.adjuntoMensaje.create({
        data: {
          mensajeId: mensaje.id,
          mimeType: adj.mimeType,
          nombreOriginal: adj.nombreOriginal,
          storageKey: adj.storageKey,
          bytes: adj.bytes,
        },
      });
    }
    await prisma.interaccion.create({
      data: {
        clienteId: conv.clienteId,
        oportunidadId: conv.oportunidadId,
        conversacionId: conv.id,
        mensajeId: mensaje.id,
        tipo: "mensaje",
        actor: actorDe(user),
        canal: conv.canal as Prisma.InteraccionCreateInput["canal"],
        resumen: resumenDe(textoGuardado),
        payload: {
          direccion: "saliente",
          autor: "asesor",
          usuarioId: user.userId,
          entrega,
        },
      },
    });
    await prisma.cliente.update({
      where: { id: conv.clienteId },
      data: { ultimoContactoEn: new Date() },
    });
    await this.recordEnMemoria(
      conv.id,
      mensaje.id,
      textoGuardado,
      externalMessageId,
    );
    this.realtime?.emit({
      type: "historial",
      clienteId: conv.clienteId,
      conversacionId: conv.id,
      mensajeId: mensaje.id,
    });
    this.realtime?.emit({ type: "bandeja", clienteId: conv.clienteId });
    await this.audit?.record({
      tipo: "asesor_mensaje_saliente",
      actor: "asesor",
      conversacionId: conv.id,
      mensajeId: mensaje.id,
      payload: { usuarioId: user.userId, entrega },
    });

    return {
      mensaje: {
        id: mensaje.id,
        contenido: mensaje.contenido,
        autor: "asesor",
        direccion: "saliente",
        creadoEn: mensaje.creadoEn.toISOString(),
        conversacionId: conv.id,
      },
      estadoBot: "humano",
      entrega,
    };
  }

  async actualizarBrief(
    id: string,
    body: unknown,
    user: PanelUser,
  ): Promise<{ id: string; campos: CamposCapturados }> {
    const parsed = ActualizarBriefRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("BRIEF_INVALIDO");
    const dto = parsed.data;
    const conv = await this.load(id, user);
    const campos: CamposCapturados = {
      ...(camposFrom(conv.camposCapturados) ?? {}),
    };
    const patch = patchDeBrief(dto);
    Object.assign(campos, patch);

    if (dto.nombre !== undefined) {
      await this.db().cliente.update({
        where: { id: conv.clienteId },
        data: { nombre: dto.nombre },
      });
    }

    await this.memoria?.aplicarCamposAsesor(conv.clienteId, patch);
    const orch = await this.orchStore?.findById(id);
    if (orch) {
      await this.orchStore?.update(id, { camposCapturados: campos });
    }
    const state: ConversacionState = orch
      ? { ...orch, camposCapturados: campos }
      : stateFromRow(conv, campos);
    await this.expediente?.persistAfterTurn(state, {
      actor: actorDe(user),
    });
    return { id, campos };
  }

  private async load(id: string, user: PanelUser): Promise<HiloRow> {
    const prisma = this.db();
    const conv = await prisma.conversacion.findFirst({
      where: { id, cliente: this.clienteScope(user) },
      include: {
        cliente: {
          select: {
            id: true,
            asesorAsignadoId: true,
            optOutMensajeria: true,
            nombre: true,
          },
        },
        oportunidad: {
          select: {
            briefJson: true,
            calificacion: true,
            listoParaCotizar: true,
          },
        },
        mensajes: {
          where: { direccion: "entrante" },
          orderBy: { creadoEn: "desc" },
          take: 1,
          select: { creadoEn: true },
        },
      },
    });
    if (!conv) throw new NotFoundException("CONVERSACION_NOT_FOUND");
    return conv as unknown as HiloRow;
  }

  private ventanaCerrada(conv: HiloRow): boolean {
    if (esHiloSandbox(conv.canal, conv.externalThreadId)) return false;
    if (conv.canal !== "whatsapp") return false;
    const ultimo = conv.mensajes[0]?.creadoEn;
    if (!ultimo) return true;
    return Date.now() - new Date(ultimo).getTime() > VENTANA_WHATSAPP_MS;
  }

  private async recordEnMemoria(
    conversacionId: string,
    mensajeId: string,
    contenido: string,
    externalMessageId: string | null,
  ): Promise<void> {
    if (!this.orchStore) return;
    try {
      const orch = await this.orchStore.findById(conversacionId);
      if (!orch) return;
      await this.orchStore.appendMensaje(conversacionId, {
        id: mensajeId,
        direccion: "saliente",
        autor: "asesor",
        contenido,
        timestamp: new Date().toISOString(),
        externalMessageId: externalMessageId ?? undefined,
        consumioCupo: false,
      });
    } catch (err) {
      this.logger.warn(
        `No se añadió el mensaje del asesor a la memoria del hilo: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private clienteScope(actor: PanelUser): Prisma.ClienteWhereInput {
    if (actor.role === "asesor") {
      return {
        OR: [
          { asesorAsignadoId: actor.userId },
          { asesorAsignadoId: null },
        ],
      };
    }
    if (!actor.sedeIds.length) return {};
    return {
      OR: [{ sedeInteresId: { in: actor.sedeIds } }, { sedeInteresId: null }],
    };
  }

  private db(): PrismaService {
    if (!this.prisma) throw new NotFoundException("CONVERSACION_NOT_FOUND");
    return this.prisma;
  }
}

function patchDeBrief(dto: ActualizarBriefRequest): Partial<CamposCapturados> {
  const patch: Partial<CamposCapturados> = {};
  if (dto.nombre !== undefined) patch.nombre = dto.nombre;
  if (dto.tipoEvento !== undefined) patch.tipoEvento = dto.tipoEvento;
  if (dto.aforo !== undefined) patch.aforo = dto.aforo;
  if (dto.fechaEstado !== undefined) patch.fechaEstado = dto.fechaEstado;
  if (dto.fechaTentativa !== undefined) {
    if (dto.fechaTentativa === null) {
      patch.fechaTentativa = null;
    } else {
      const fecha = isoToFechaTentativa(dto.fechaTentativa);
      if (!fecha) throw new BadRequestException("FECHA_INVALIDA");
      patch.fechaTentativa = fecha;
      if (dto.fechaEstado === undefined) patch.fechaEstado = "definida";
    }
  }
  if (dto.rangoPresupuestoFuera !== undefined) {
    patch.rangoPresupuestoFuera = dto.rangoPresupuestoFuera;
    if (dto.rangoPresupuestoFuera) {
      patch.rangoInversion = null;
      patch.encajeEconomico = "no";
      patch.presupuestoOrientativo = presupuestoFromRangoPresupuestoFuera(
        dto.rangoPresupuestoFuera,
      );
    }
  }
  if (dto.rangoInversion !== undefined) {
    patch.rangoInversion = dto.rangoInversion;
    if (dto.rangoInversion) {
      patch.rangoPresupuestoFuera = null;
      patch.encajeEconomico = encajeDeRango(dto.rangoInversion);
      patch.presupuestoOrientativo = presupuestoFromRango(dto.rangoInversion);
    } else if (dto.rangoPresupuestoFuera === undefined) {
      patch.encajeEconomico = null;
    }
  }
  return patch;
}

function stateFromRow(row: HiloRow, campos: CamposCapturados): ConversacionState {
  const brief =
    row.oportunidad.briefJson &&
    typeof row.oportunidad.briefJson === "object" &&
    !Array.isArray(row.oportunidad.briefJson)
      ? (row.oportunidad.briefJson as Record<string, unknown>)
      : { version: 1, actualizadoPor: "asesor" };
  const cola =
    row.cola === "comercial" || row.cola === "atencion_general"
      ? row.cola
      : null;
  return {
    id: row.id,
    canal: row.canal,
    externalThreadId: row.externalThreadId ?? "",
    estadoBot: row.estadoBot,
    pasoGuion: row.pasoGuion,
    camposCapturados: campos,
    paqueteTentativoId: row.paqueteTentativoId,
    ultimaRuta: row.ultimaRuta,
    motivoHandoff: row.motivoHandoff,
    escaladoEn: row.escaladoEn?.toISOString() ?? null,
    oportunidadId: row.oportunidadId,
    brief,
    calificado: row.oportunidad.calificacion === "calificado",
    listoParaCotizar: row.oportunidad.listoParaCotizar,
    mensajes: [],
    creadoEn: row.creadoEn.toISOString(),
    actualizadoEn: new Date().toISOString(),
    guionVersion: (row.guionVersion as ConversacionState["guionVersion"]) ?? null,
    asesorLockId: row.asesorLockId,
    slaVenceEn: row.slaVenceEn?.toISOString() ?? null,
    cola: cola as ColaAsesor | null,
  };
}

function esHiloSandbox(canal: string, externalThreadId: string | null): boolean {
  if (canal === "sandbox") return true;
  return (externalThreadId ?? "").toLowerCase().startsWith("sandbox");
}

function canalSaliente(canal: string): Canal {
  if (canal === "instagram" || canal === "facebook" || canal === "whatsapp") {
    return canal;
  }
  return "whatsapp";
}

function actorDe(user: PanelUser): "asesor" | "coordinador" | "admin" {
  if (user.role === "coordinador" || user.role === "admin") return user.role;
  return "asesor";
}

function resumenDe(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= 180 ? t : `${t.slice(0, 179)}…`;
}

function camposFrom(json: unknown): CamposCapturados {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  return { ...(json as CamposCapturados) };
}

function conflict(code: string, message: string): HttpException {
  return new HttpException(
    { error: { code, message } },
    HttpStatus.CONFLICT,
  );
}

function envioFallido(reason: string): HttpException {
  return new HttpException(
    {
      error: {
        code: "ENVIO_FALLIDO",
        message: "No se pudo enviar el mensaje",
        reason,
      },
    },
    HttpStatus.BAD_GATEWAY,
  );
}
