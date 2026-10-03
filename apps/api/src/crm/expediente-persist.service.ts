import { Injectable, Logger, Optional } from "@nestjs/common";
import type {
  Canal,
  EstadoAtencion,
  PasoGuion,
  Prisma,
  TipoEvento,
  TipoIdentificadorCliente,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AssignmentService } from "../assignment/assignment.service";
import { fechaTentativaToIso } from "../conversation/script/fecha-tentativa.parser";
import {
  isPerfilListo,
  looksLikePersonName,
  type PedidoCotizacionFuente,
} from "../conversation/script/harvest-campos";
import type {
  CamposCapturados,
  ConversacionState,
  MensajeRecord,
} from "../conversation/types";
import {
  normalizeTelefono,
  phoneFingerprint,
  resolveTelefonoCanal,
} from "../conversation/telefono";
import {
  identifiersFromThread,
  mapCanalCrm,
  mapEstadoAtencion,
  type IdentificadorCandidato,
} from "./cliente-identity";
import { IdentidadService } from "./identidad.service";
import { ClienteMemoriaService } from "../conversation/memoria/cliente-memoria.service";
import {
  derivarInteligencia,
  nextEtapaPipeline,
} from "./inteligencia/playbook-evento";
import type {
  EtapaCotizacion,
  EtapaPipeline,
  VisitaEstado,
} from "@prisma/client";

const TIPOS_EVENTO = new Set<TipoEvento>([
  "boda",
  "xv",
  "corporativo",
  "social",
  "otro",
  "multi",
]);

export interface PersistTurnExtras {
  plantillaUtilityId?: string | null;
}

const RECONTACTO_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ExpedientePersistService {
  private readonly logger = new Logger(ExpedientePersistService.name);
  private readonly identidad: IdentidadService | undefined;

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly assignment?: AssignmentService,
    @Optional() identidad?: IdentidadService,
    @Optional() private readonly memoria?: ClienteMemoriaService,
  ) {
    this.identidad = identidad ?? (prisma ? new IdentidadService(prisma) : undefined);
  }

  async persistAfterTurn(
    conv: ConversacionState,
    extras: PersistTurnExtras = {},
  ): Promise<void> {
    if (!this.canWrite()) return;
    try {
      await this.upsert(conv, extras);
    } catch (err) {
      const waId =
        conv.perfilCanal?.waId ??
        conv.camposCapturados.telefono ??
        conv.externalThreadId;
      this.logger.error(
        `No se pudo persistir expediente ${conv.id} hilo=${conv.externalThreadId} wa_id=${waId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async persistTomaControl(input: {
    conversacionId: string;
    usuarioId: string;
    motivo?: string | null;
  }): Promise<void> {
    if (!this.canWrite()) return;
    const prisma = this.prisma!;
    try {
      const conv = await prisma.conversacion.findUnique({
        where: { id: input.conversacionId },
      });
      if (!conv) return;
      const prev = conv.estadoBot;
      await prisma.conversacion.update({
        where: { id: conv.id },
        data: { estadoBot: "humano", asesorLockId: input.usuarioId },
      });
      await this.syncEstadoBotCliente(conv.clienteId, {
        estadoBot: "humano",
        asesorLockId: input.usuarioId,
      });
      this.memoria?.syncEstado(conv.clienteId, {
        estadoBot: "humano",
        asesorLockId: input.usuarioId,
      });
      await this.syncEstadoAtencion(conv.clienteId, "en_atencion", {
        conversacionId: conv.id,
        oportunidadId: conv.oportunidadId,
        actor: "asesor",
        resumen: "Asesor tomó control",
        payload: {
          estadoBotAnterior: prev,
          usuarioId: input.usuarioId,
          motivo: input.motivo ?? null,
        },
      });
      const cliente = await prisma.cliente.findUnique({
        where: { id: conv.clienteId },
      });
      if (cliente && !cliente.asesorAsignadoId) {
        await this.applyAsignacion({
          clienteId: conv.clienteId,
          oportunidadId: conv.oportunidadId,
          asesorId: input.usuarioId,
          regla: "manual",
          actor: "sistema",
          actorUsuarioId: input.usuarioId,
          motivo: input.motivo ?? "toma_control",
        });
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo persistir toma de control ${input.conversacionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async findLock(conversacionId: string): Promise<string | null> {
    if (!this.canWrite()) return null;
    const row = await this.prisma!.conversacion.findUnique({
      where: { id: conversacionId },
      select: { asesorLockId: true },
    });
    return row?.asesorLockId ?? null;
  }

  async persistDevolverABot(input: {
    conversacionId: string;
    motivo: string;
  }): Promise<void> {
    if (!this.canWrite()) return;
    try {
      const conv = await this.prisma!.conversacion.findUnique({
        where: { id: input.conversacionId },
        select: { clienteId: true },
      });
      await this.prisma!.conversacion.update({
        where: { id: input.conversacionId },
        data: {
          estadoBot: "activo",
          asesorLockId: null,
          slaVenceEn: null,
        },
      });
      if (conv?.clienteId) {
        await this.syncEstadoBotCliente(conv.clienteId, {
          estadoBot: "activo",
          asesorLockId: null,
          slaVenceEn: null,
        });
        this.memoria?.syncEstado(conv.clienteId, {
          estadoBot: "activo",
          asesorLockId: null,
          slaVenceEn: null,
        });
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo devolver a bot ${input.conversacionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private canWrite(): boolean {
    return Boolean(this.prisma && process.env.DATABASE_URL);
  }

  private async upsert(
    conv: ConversacionState,
    extras: PersistTurnExtras,
  ): Promise<void> {
    const prisma = this.prisma!;
    const canal = mapCanalCrm(conv.canal);
    const campos = conv.camposCapturados;
    const telefono =
      normalizeTelefono(campos.telefono) ??
      resolveTelefonoCanal({
        waId: conv.perfilCanal?.waId,
        externalThreadId: conv.externalThreadId,
      });
    const fechaIso = fechaTentativaToIso(campos.fechaTentativa ?? null);
    const tipoEvento = mapTipoEvento(campos.tipoEvento);
    const estadoAtencion = mapEstadoAtencion(conv.estadoBot);
    const identifiers = identifiersFromThread({
      canal: conv.canal,
      externalThreadId: conv.externalThreadId,
      perfil: conv.perfilCanal,
      campos,
    });

    const existing = await prisma.conversacion.findUnique({
      where: {
        canal_externalThreadId: {
          canal,
          externalThreadId: conv.externalThreadId,
        },
      },
      include: { cliente: true, oportunidad: true },
    });

    const nombreValido =
      campos.nombre && looksLikePersonName(campos.nombre)
        ? campos.nombre
        : null;
    const perfilRaw = conv.perfilCanal?.nombre?.trim() || null;
    const perfilNombre =
      perfilRaw && looksLikePersonName(perfilRaw) ? perfilRaw : null;
    const correo = identifiers.find((i) => i.tipo === "email")?.valor ?? null;

    const resolved = await this.resolveCliente({
      existingClienteId:
        existing?.clienteId ?? existing?.oportunidad.clienteId,
      identifiers,
      display: {
        nombre: nombreValido,
        telefono: telefono ? telefono : null,
        nombrePerfilCanal: perfilNombre,
        correo,
        canalOrigen: canal,
        sedeInteresId: campos.sedeId ?? null,
      },
      conversacionId: existing?.id ?? conv.id,
      oportunidadId: existing?.oportunidadId ?? conv.oportunidadId,
      isNewThread: !existing,
      hilo: conv.externalThreadId,
      waId: conv.perfilCanal?.waId ?? telefono,
    });
    const cliente = resolved.cliente;

    const paqueteId = await this.safePaqueteId(conv.paqueteTentativoId);
    const fechaTentativa = fechaIso
      ? new Date(`${fechaIso}T12:00:00.000Z`)
      : null;
    const prevOpp = existing?.oportunidad ?? null;
    const comercial = comercialFromTurn({
      conv,
      prev: prevOpp,
      paqueteId,
      tipoEvento: tipoEvento ?? null,
      fechaTentativa,
      sedeNombre: campos.sedeNombre ?? null,
    });

    const oppData = {
      tipoEvento: tipoEvento ?? null,
      fechaTentativa,
      fechaFlexible: Boolean(campos.fechaTentativa?.flexible),
      aforo: campos.aforo ?? null,
      sede: campos.sedeNombre ?? null,
      ...(paqueteId ? { paqueteTentativoId: paqueteId } : {}),
      briefJson: (conv.brief ?? {}) as Prisma.InputJsonValue,
      calificacion: conv.calificado
        ? ("calificado" as const)
        : ("en_exploracion" as const),
      listoParaCotizar: conv.listoParaCotizar,
      canalOrigen: canal,
      intencionVisita: comercial.intencionVisita,
      visitaEstado: comercial.visitaEstado,
      etapa: comercial.etapa,
      etapaCotizacion: comercial.etapaCotizacion,
    };

    let oportunidadId: string;
    let conversacionId: string;

    if (existing) {
      oportunidadId = existing.oportunidadId;
      conversacionId = existing.id;
      if (existing.clienteId !== cliente.id) {
        await prisma.oportunidad.update({
          where: { id: existing.oportunidadId },
          data: { clienteId: cliente.id, ...oppData },
        });
      } else {
        await prisma.oportunidad.update({
          where: { id: existing.oportunidadId },
          data: oppData,
        });
      }
      await prisma.conversacion.update({
        where: { id: existing.id },
        data: {
          clienteId: cliente.id,
          pasoGuion: conv.pasoGuion as PasoGuion,
          camposCapturados: camposToJson(campos),
          estadoBot: conv.estadoBot,
          sede: campos.sedeNombre ?? null,
          ultimaRuta: conv.ultimaRuta,
          motivoHandoff: conv.motivoHandoff,
          escaladoEn: conv.escaladoEn ? new Date(conv.escaladoEn) : undefined,
          encajeEconomico: campos.encajeEconomico ?? null,
          rutaComercial: campos.rutaComercial ?? null,
          guionVersion: conv.guionVersion ?? null,
          asesorLockId: conv.asesorLockId ?? null,
          slaVenceEn: conv.slaVenceEn ? new Date(conv.slaVenceEn) : null,
          cola: conv.cola ?? null,
        },
      });
    } else {
      const abierta = await this.oportunidadAbierta(prisma, cliente.id);
      if (abierta) {
        oportunidadId = abierta.id;
        await prisma.oportunidad.update({
          where: { id: abierta.id },
          data: oppData,
        });
      } else {
        const opp = await prisma.oportunidad.create({
          data: {
            id: conv.oportunidadId,
            clienteId: cliente.id,
            ...oppData,
          },
        });
        oportunidadId = opp.id;
      }
      const created = await prisma.conversacion.create({
        data: {
          id: conv.id,
          clienteId: cliente.id,
          oportunidadId,
          canal,
          externalThreadId: conv.externalThreadId,
          estadoBot: conv.estadoBot,
          pasoGuion: conv.pasoGuion as PasoGuion,
          camposCapturados: camposToJson(campos),
          sede: campos.sedeNombre ?? null,
          ultimaRuta: conv.ultimaRuta,
          motivoHandoff: conv.motivoHandoff,
          escaladoEn: conv.escaladoEn ? new Date(conv.escaladoEn) : undefined,
          encajeEconomico: campos.encajeEconomico ?? null,
          rutaComercial: campos.rutaComercial ?? null,
          guionVersion: conv.guionVersion ?? null,
          asesorLockId: conv.asesorLockId ?? null,
          slaVenceEn: conv.slaVenceEn ? new Date(conv.slaVenceEn) : null,
          cola: conv.cola ?? null,
        },
      });
      conversacionId = created.id;
    }

    await this.syncEstadoBotCliente(cliente.id, { estadoBot: conv.estadoBot });
    await this.memoria?.flush(cliente.id, {
      ...conv,
      oportunidadId,
      id: conversacionId,
    });

    await this.syncEstadoAtencion(cliente.id, estadoAtencion, {
      conversacionId,
      oportunidadId,
      actor: "bot",
      resumen: `Estado de atención → ${estadoAtencion}`,
      payload: { estadoBot: conv.estadoBot },
      skipIfSame: true,
    });

    await this.persistMensajes({
      conv,
      canal,
      clienteId: cliente.id,
      conversacionId,
      oportunidadId,
      plantillaUtilityId: extras.plantillaUtilityId,
    });

    await this.persistConsultaCatalogo({
      clienteId: cliente.id,
      oportunidadId,
      conversacionId,
      conv,
      previousBrief: existing?.oportunidad?.briefJson ?? null,
    });

    await this.emitHechosComerciales({
      clienteId: cliente.id,
      oportunidadId,
      conversacionId,
      conv,
      previous: existing?.oportunidad ?? null,
      previousCampos: existing?.camposCapturados ?? null,
      visitaChanged: comercial.visitaChanged,
      visitaEstado: comercial.visitaEstado,
      etapaChanged: comercial.etapaChanged,
      etapa: comercial.etapa,
    });

    if (conv.estadoBot === "escalado" || conv.estadoBot === "humano") {
      await this.assignOnHandoff({
        clienteId: cliente.id,
        oportunidadId,
        conversacionId,
        sedeId: campos.sedeId ?? null,
        motivo: conv.motivoHandoff,
        cola:
          campos.rutaComercial === "atencion_general"
            ? "atencion_general"
            : "comercial",
        rutaComercial: campos.rutaComercial ?? null,
      });
    }
  }

  private async resolveCliente(input: {
    existingClienteId?: string;
    identifiers: IdentificadorCandidato[];
    display: {
      nombre: string | null;
      telefono: string | null;
      nombrePerfilCanal: string | null;
      correo: string | null;
      canalOrigen: Canal;
      sedeInteresId: string | null;
    };
    conversacionId: string;
    oportunidadId: string;
    isNewThread: boolean;
    hilo: string;
    waId: string | null;
  }) {
    const prisma = this.prisma!;
    const matchedIds = await this.identidad?.findMatchingClienteIds(
      input.identifiers,
    );
    const candidateIds = [
      ...new Set(
        [...(matchedIds ?? []), input.existingClienteId].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
    let canonical = await this.identidad?.pickCanonical(candidateIds);
    if (!canonical) {
      const ownerIds = await this.ownerIds(input.identifiers);
      if (ownerIds.length) {
        canonical =
          (await this.identidad?.pickCanonical(ownerIds)) ??
          (await this.loadIdentity(ownerIds[0]));
      }
    }
    const duplicados: Array<{
      tipo: string;
      valor: string;
      otroClienteId: string;
    }> = [];

    let cliente;
    let reused = false;
    let createdFresh = false;
    let prevUltimo: Date | null = null;
    let prevEstado: string | null = null;
    let priorHilos = 0;
    const sedeInteresId = await this.safeSedeId(input.display.sedeInteresId);
    const identity = buildIdentityWrite(
      canonical ? "update" : "create",
      canonical ?? null,
      input.display,
    );
    const correoOcupado = canonical?.correo?.trim().toLowerCase() || null;

    if (canonical) {
      reused = true;
      prevUltimo = canonical.ultimoContactoEn;
      prevEstado = canonical.estadoAtencion;
      priorHilos = await prisma.conversacion.count({
        where: {
          clienteId: canonical.id,
          id: { not: input.conversacionId },
        },
      });
      cliente = await prisma.cliente.update({
        where: { id: canonical.id },
        data: {
          ...identity,
          canalOrigen: input.display.canalOrigen,
          sedeInteresId: sedeInteresId ?? undefined,
          ultimoContactoEn: new Date(),
        },
      });
    } else {
      createdFresh = true;
      cliente = await prisma.cliente.create({
        data: {
          nombre: identity.nombre ?? null,
          telefono: identity.telefono ?? null,
          correo: identity.correo ?? null,
          nombrePerfilCanal: identity.nombrePerfilCanal ?? null,
          canalOrigen: input.display.canalOrigen,
          fuenteAlta: "bot",
          sedeInteresId,
          estadoAtencion: "nuevo",
        },
      });
    }

    for (const ident of input.identifiers) {
      if (
        ident.tipo === "email" &&
        ((correoOcupado && correoOcupado !== ident.valorNormalizado) ||
          (!correoOcupado && !input.display.correo))
      ) {
        continue;
      }
      const owned = await prisma.identificadorCliente.findUnique({
        where: {
          tipo_valorNormalizado: {
            tipo: ident.tipo as TipoIdentificadorCliente,
            valorNormalizado: ident.valorNormalizado,
          },
        },
      });
      if (!owned) {
        try {
          await prisma.identificadorCliente.create({
            data: {
              clienteId: cliente.id,
              tipo: ident.tipo as TipoIdentificadorCliente,
              valor: ident.valor,
              valorNormalizado: ident.valorNormalizado,
            },
          });
        } catch (err) {
          const again = await prisma.identificadorCliente.findUnique({
            where: {
              tipo_valorNormalizado: {
                tipo: ident.tipo as TipoIdentificadorCliente,
                valorNormalizado: ident.valorNormalizado,
              },
            },
          });
          if (again && again.clienteId !== cliente.id && createdFresh) {
            const adopted = await this.adoptOwner(
              again.clienteId,
              cliente.id,
              input,
              sedeInteresId,
            );
            if (adopted) {
              cliente = adopted.cliente;
              createdFresh = false;
              reused = true;
              prevUltimo = adopted.prevUltimo;
              prevEstado = adopted.prevEstado;
              priorHilos = adopted.priorHilos;
              continue;
            }
          }
          this.logger.error(
            `No se pudo guardar identificador ${ident.tipo} hilo=${input.hilo} wa_id=${input.waId ?? "sin-wa"}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          throw err;
        }
      } else if (owned.clienteId !== cliente.id) {
        if (createdFresh) {
          const adopted = await this.adoptOwner(
            owned.clienteId,
            cliente.id,
            input,
            sedeInteresId,
          );
          if (adopted) {
            cliente = adopted.cliente;
            createdFresh = false;
            reused = true;
            prevUltimo = adopted.prevUltimo;
            prevEstado = adopted.prevEstado;
            priorHilos = adopted.priorHilos;
            continue;
          }
          this.logger.error(
            `Identificador ${ident.tipo} pertenece a ${owned.clienteId} y no se pudo reutilizar hilo=${input.hilo} wa_id=${input.waId ?? "sin-wa"}`,
          );
        }
        duplicados.push({
          tipo: ident.tipo,
          valor: ident.valorNormalizado,
          otroClienteId: owned.clienteId,
        });
      }
    }

    for (const otherId of candidateIds.filter((id) => id !== cliente.id)) {
      duplicados.push({
        tipo: "telefono",
        valor: phoneFingerprint(input.display.telefono) ?? "",
        otroClienteId: otherId,
      });
    }

    for (const dup of uniqueDups(duplicados)) {
      if (!dup.otroClienteId) continue;
      const existentes = await prisma.interaccion.findMany({
        where: { clienteId: cliente.id, tipo: "posible_duplicado" },
      });
      const ya = existentes.some(
        (row) =>
          (row.payload as { otroClienteId?: string } | null)?.otroClienteId ===
          dup.otroClienteId,
      );
      if (ya) continue;
      await prisma.interaccion.create({
        data: {
          clienteId: cliente.id,
          conversacionId: input.conversacionId,
          oportunidadId: input.oportunidadId,
          tipo: "posible_duplicado",
          actor: "sistema",
          resumen: `Identificador ${dup.tipo} ya pertenece a otro cliente`,
          payload: dup as Prisma.InputJsonValue,
        },
      });
    }

    if (reused) {
      const stale =
        (prevUltimo && Date.now() - prevUltimo.getTime() > RECONTACTO_MS) ||
        prevEstado === "cerrado";
      const newThreadWithHistory = input.isNewThread && priorHilos > 0;
      if (stale || newThreadWithHistory) {
        const ya = await prisma.interaccion.findFirst({
          where: {
            clienteId: cliente.id,
            conversacionId: input.conversacionId,
            tipo: "recontacto",
          },
        });
        if (!ya) {
          await prisma.interaccion.create({
            data: {
              clienteId: cliente.id,
              conversacionId: input.conversacionId,
              oportunidadId: input.oportunidadId,
              tipo: "recontacto",
              actor: "sistema",
              resumen: "Recontacto: se recuperó historial anterior del cliente",
              payload: {
                hilosPrevios: priorHilos,
                ultimoContactoEn: prevUltimo?.toISOString() ?? null,
                estadoAnterior: prevEstado,
              },
            },
          });
        }
      }
    }

    return { cliente };
  }

  private async ownerIds(
    identifiers: IdentificadorCandidato[],
  ): Promise<string[]> {
    const prisma = this.prisma!;
    const ids: string[] = [];
    for (const ident of identifiers) {
      const owned = await prisma.identificadorCliente.findUnique({
        where: {
          tipo_valorNormalizado: {
            tipo: ident.tipo as TipoIdentificadorCliente,
            valorNormalizado: ident.valorNormalizado,
          },
        },
        select: { clienteId: true },
      });
      if (owned) ids.push(owned.clienteId);
    }
    return [...new Set(ids)];
  }

  private loadIdentity(id: string) {
    return this.prisma!.cliente.findUnique({ where: { id } });
  }

  private async adoptOwner(
    ownerId: string,
    orphanId: string,
    input: {
      display: {
        nombre: string | null;
        telefono: string | null;
        nombrePerfilCanal: string | null;
        correo: string | null;
        canalOrigen: Canal;
        sedeInteresId: string | null;
      };
      conversacionId: string;
      hilo: string;
      waId: string | null;
    },
    sedeInteresId: string | null,
  ) {
    const owner = await this.loadIdentity(ownerId);
    if (!owner) {
      this.logger.error(
        `Identificador apunta a cliente ausente ${ownerId} hilo=${input.hilo} wa_id=${input.waId ?? "sin-wa"}`,
      );
      return null;
    }
    const identity = buildIdentityWrite("update", owner, input.display);
    const cliente = await this.prisma!.cliente.update({
      where: { id: owner.id },
      data: {
        ...identity,
        canalOrigen: input.display.canalOrigen,
        sedeInteresId: sedeInteresId ?? undefined,
        ultimoContactoEn: new Date(),
      },
    });
    try {
      await this.prisma!.cliente.delete({ where: { id: orphanId } });
    } catch (err) {
      this.logger.error(
        `Alta huérfana ${orphanId} hilo=${input.hilo} wa_id=${input.waId ?? "sin-wa"}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    const priorHilos = await this.prisma!.conversacion.count({
      where: {
        clienteId: owner.id,
        id: { not: input.conversacionId },
      },
    });
    return {
      cliente,
      prevUltimo: owner.ultimoContactoEn,
      prevEstado: owner.estadoAtencion,
      priorHilos,
    };
  }

  private async safeSedeId(sedeId: string | null): Promise<string | null> {
    if (!sedeId || !this.prisma) return null;
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      select: { id: true },
    });
    return sede?.id ?? null;
  }

  private async safePaqueteId(
    paqueteId: string | null,
  ): Promise<string | null> {
    if (!paqueteId || !this.prisma) return null;
    const row = await this.prisma.paquete.findUnique({
      where: { id: paqueteId },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  private async emitHechosComerciales(input: {
    clienteId: string;
    oportunidadId: string;
    conversacionId: string;
    conv: ConversacionState;
    previous: {
      listoParaCotizar: boolean;
      tipoEvento: string | null;
      aforo: number | null;
      sede: string | null;
      fechaTentativa: Date | null;
      paqueteTentativoId: string | null;
      visitaEstado?: VisitaEstado;
      etapa?: EtapaPipeline;
    } | null;
    previousCampos: unknown;
    visitaChanged: boolean;
    visitaEstado: VisitaEstado;
    etapaChanged: boolean;
    etapa: EtapaPipeline;
  }): Promise<void> {
    const prisma = this.prisma!;
    const prev = input.previous;
    if (input.visitaChanged && input.visitaEstado === "solicitada") {
      await prisma.interaccion.create({
        data: {
          clienteId: input.clienteId,
          oportunidadId: input.oportunidadId,
          conversacionId: input.conversacionId,
          tipo: "cambio_visita",
          actor: "bot",
          resumen: "Visita al jardín solicitada",
          payload: { visitaEstado: "solicitada" },
        },
      });
    }
    if (input.etapaChanged) {
      await prisma.interaccion.create({
        data: {
          clienteId: input.clienteId,
          oportunidadId: input.oportunidadId,
          conversacionId: input.conversacionId,
          tipo: "cambio_etapa",
          actor: "bot",
          resumen: `Etapa → ${input.etapa}`,
          payload: {
            de: prev?.etapa ?? "nuevo_bot",
            a: input.etapa,
          },
        },
      });
    }
    await this.emitPedidoCotizacion({
      clienteId: input.clienteId,
      oportunidadId: input.oportunidadId,
      conversacionId: input.conversacionId,
      conv: input.conv,
      previousCampos: input.previousCampos,
    });

    if (!prev) return;
    const fechaIso = fechaTentativaToIso(
      input.conv.camposCapturados.fechaTentativa ?? null,
    );
    const nextFecha = fechaIso ? `${fechaIso}T12:00:00.000Z` : null;
    const prevFecha = prev.fechaTentativa
      ? prev.fechaTentativa.toISOString()
      : null;
    const campos: string[] = [];
    if ((prev.tipoEvento ?? null) !== (mapTipoEvento(input.conv.camposCapturados.tipoEvento) ?? null)) {
      campos.push("tipoEvento");
    }
    if ((prev.aforo ?? null) !== (input.conv.camposCapturados.aforo ?? null)) {
      campos.push("aforo");
    }
    if ((prev.sede ?? null) !== (input.conv.camposCapturados.sedeNombre ?? null)) {
      campos.push("sede");
    }
    if (prevFecha !== nextFecha) campos.push("fechaTentativa");
    if ((prev.paqueteTentativoId ?? null) !== (input.conv.paqueteTentativoId ?? null)) {
      campos.push("paquete");
    }
    if (campos.length === 0) return;
    await prisma.interaccion.create({
      data: {
        clienteId: input.clienteId,
        oportunidadId: input.oportunidadId,
        conversacionId: input.conversacionId,
        tipo: "brief_actualizado",
        actor: "bot",
        resumen: `Brief actualizado (${campos.join(", ")})`,
        payload: { campos },
      },
    });
  }

  private async emitPedidoCotizacion(input: {
    clienteId: string;
    oportunidadId: string;
    conversacionId: string;
    conv: ConversacionState;
    previousCampos: unknown;
  }): Promise<void> {
    const pedido = input.conv.pedidoCotizacion;
    if (pedido !== true && pedido !== false) return;
    if (!isPerfilListo(input.conv.camposCapturados)) return;

    const justListo =
      isPerfilListo(input.conv.camposCapturados) &&
      !isPerfilListo(camposFromStored(input.previousCampos));

    const last = await this.prisma!.interaccion.findFirst({
      where: {
        oportunidadId: input.oportunidadId,
        tipo: "intencion_cotizar",
      },
      orderBy: { creadoEn: "desc" },
    });
    const lastPedido = pedidoFromPayload(last?.payload);
    const shouldEmit =
      (justListo && lastPedido == null) ||
      (lastPedido === false && pedido === true);
    if (!shouldEmit) return;

    const fuente =
      (input.conv.pedidoCotizacionFuente as PedidoCotizacionFuente | null) ??
      null;
    await this.prisma!.interaccion.create({
      data: {
        clienteId: input.clienteId,
        oportunidadId: input.oportunidadId,
        conversacionId: input.conversacionId,
        tipo: "intencion_cotizar",
        actor: "bot",
        resumen: pedido
          ? "Lead pidió cotizar"
          : "Lead no pidió cotizar",
        payload: {
          pedido,
          fuente,
          pasoGuion: input.conv.pasoGuion,
        },
      },
    });
  }

  private async persistConsultaCatalogo(input: {
    clienteId: string;
    oportunidadId: string;
    conversacionId: string;
    conv: ConversacionState;
    previousBrief: unknown;
  }): Promise<void> {
    const snapshot = consultaFromBrief(input.conv.brief);
    if (!snapshot) return;
    const prev = consultaFromBrief(input.previousBrief);
    if (prev?.id === snapshot.id) return;
    const prisma = this.prisma!;
    await prisma.eventoOperativo.create({
      data: {
        tipo: "consulta_catalogo",
        actor: "bot",
        payload: snapshot as Prisma.InputJsonValue,
        clienteId: input.clienteId,
        oportunidadId: input.oportunidadId,
        conversacionId: input.conversacionId,
      },
    });
  }

  private async persistMensajes(input: {
    conv: ConversacionState;
    canal: Canal;
    clienteId: string;
    conversacionId: string;
    oportunidadId: string;
    plantillaUtilityId?: string | null;
  }): Promise<void> {
    const prisma = this.prisma!;
    const lastSaliente = [...input.conv.mensajes]
      .reverse()
      .find((m) => m.direccion === "saliente");

    for (const msg of input.conv.mensajes) {
      const plantilla =
        lastSaliente && msg.id === lastSaliente.id
          ? (input.plantillaUtilityId ?? msg.plantillaUtilityId ?? null)
          : (msg.plantillaUtilityId ?? null);
      const row = await this.upsertMensaje(input.conversacionId, input.canal, {
        ...msg,
        plantillaUtilityId: plantilla,
      });
      if (!row.created) continue;

      await prisma.interaccion.create({
        data: {
          clienteId: input.clienteId,
          oportunidadId: input.oportunidadId,
          conversacionId: input.conversacionId,
          mensajeId: row.id,
          tipo: plantilla ? "plantilla" : "mensaje",
          actor:
            msg.autor === "asesor"
              ? "asesor"
              : msg.autor === "bot"
                ? "bot"
                : "sistema",
          canal: input.canal,
          resumen: truncate(msg.contenido, 180),
          payload: {
            direccion: msg.direccion,
            autor: msg.autor,
            plantillaUtilityId: plantilla,
          },
        },
      });

      for (const adj of msg.adjuntos ?? []) {
        await prisma.adjuntoMensaje.create({
          data: {
            mensajeId: row.id,
            mimeType: adj.mimeType,
            nombreOriginal: adj.nombreOriginal ?? null,
            storageKey: adj.storageKey ?? null,
            bytes: adj.sizeBytes ?? null,
          },
        });
        await prisma.interaccion.create({
          data: {
            clienteId: input.clienteId,
            oportunidadId: input.oportunidadId,
            conversacionId: input.conversacionId,
            mensajeId: row.id,
            tipo: "adjunto",
            actor: "bot",
            canal: input.canal,
            resumen: adj.nombreOriginal ?? adj.mimeType,
            payload: {
              mimeType: adj.mimeType,
              storageKey: adj.storageKey ?? null,
            },
          },
        });
      }
    }
  }

  private async upsertMensaje(
    conversacionId: string,
    canal: Canal,
    msg: MensajeRecord,
  ): Promise<{ id: string; created: boolean }> {
    const prisma = this.prisma!;
    if (msg.externalMessageId) {
      const existing = await prisma.mensaje.findUnique({
        where: {
          canal_externalMessageId: {
            canal,
            externalMessageId: msg.externalMessageId,
          },
        },
      });
      if (existing) return { id: existing.id, created: false };
    } else {
      const byId = await prisma.mensaje.findUnique({ where: { id: msg.id } });
      if (byId) return { id: byId.id, created: false };
    }

    const created = await prisma.mensaje.create({
      data: {
        id: msg.id,
        conversacionId,
        direccion: msg.direccion,
        autor: msg.autor,
        canal,
        contenido: msg.contenido,
        externalMessageId: msg.externalMessageId ?? null,
        ruta: msg.ruta ?? null,
        consumeCupo: msg.consumioCupo,
        plantillaUtilityId: msg.plantillaUtilityId ?? null,
        creadoEn: msg.timestamp ? new Date(msg.timestamp) : undefined,
      },
    });
    return { id: created.id, created: true };
  }

  private async oportunidadAbierta(
    prisma: PrismaService,
    clienteId: string,
  ): Promise<{ id: string } | null> {
    const finder = (
      prisma.oportunidad as unknown as {
        findFirst?: (args: unknown) => Promise<{ id: string } | null>;
      }
    ).findFirst;
    if (typeof finder !== "function") return null;
    return finder({
      where: {
        clienteId,
        etapa: { notIn: ["ganado", "perdido"] },
      },
      orderBy: { actualizadoEn: "desc" },
      select: { id: true },
    });
  }

  private async syncEstadoBotCliente(
    clienteId: string,
    data: {
      estadoBot: "activo" | "escalado" | "humano";
      asesorLockId?: string | null;
      slaVenceEn?: Date | null;
    },
  ): Promise<void> {
    const updateMany = (
      this.prisma!.conversacion as unknown as {
        updateMany?: (args: unknown) => Promise<unknown>;
      }
    ).updateMany;
    if (typeof updateMany !== "function") return;
    await updateMany({
      where: { clienteId },
      data,
    });
  }

  private async syncEstadoAtencion(
    clienteId: string,
    siguiente: EstadoAtencion,
    meta: {
      conversacionId?: string;
      oportunidadId?: string;
      actor: "bot" | "asesor" | "sistema";
      resumen: string;
      payload: Prisma.InputJsonValue;
      skipIfSame?: boolean;
    },
  ): Promise<void> {
    const prisma = this.prisma!;
    const current = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { estadoAtencion: true },
    });
    if (!current) return;
    if (meta.skipIfSame && current.estadoAtencion === siguiente) return;
    await prisma.cliente.update({
      where: { id: clienteId },
      data: { estadoAtencion: siguiente, ultimoContactoEn: new Date() },
    });
    await prisma.interaccion.create({
      data: {
        clienteId,
        conversacionId: meta.conversacionId,
        oportunidadId: meta.oportunidadId,
        tipo: "cambio_estado_atencion",
        actor: meta.actor,
        resumen: meta.resumen,
        payload: {
          ...(typeof meta.payload === "object" && meta.payload
            ? (meta.payload as object)
            : {}),
          de: current.estadoAtencion,
          a: siguiente,
        },
      },
    });
  }

  private async assignOnHandoff(input: {
    clienteId: string;
    oportunidadId: string;
    conversacionId: string;
    sedeId: string | null;
    motivo: string | null;
    cola?: "comercial" | "atencion_general";
    rutaComercial?: string | null;
  }): Promise<void> {
    const prisma = this.prisma!;
    const cliente = await prisma.cliente.findUnique({
      where: { id: input.clienteId },
    });
    if (!cliente || cliente.asesorAsignadoId) return;

    const pick = await this.assignment?.pickAsesorPersistible({
      sedeId: input.sedeId,
    });
    if (!pick) return;

    await this.applyAsignacion({
      clienteId: input.clienteId,
      oportunidadId: input.oportunidadId,
      asesorId: pick.asesorId,
      regla: pick.regla,
      actor: "sistema",
      motivo: input.motivo ?? "handoff",
    });
    await prisma.interaccion.create({
      data: {
        clienteId: input.clienteId,
        oportunidadId: input.oportunidadId,
        conversacionId: input.conversacionId,
        tipo: "handoff",
        actor: "sistema",
        resumen: "Handoff: cliente asignado a asesor",
        payload: {
          asesorId: pick.asesorId,
          regla: pick.regla,
          motivo: input.motivo,
          cola: input.cola ?? "comercial",
          rutaComercial: input.rutaComercial ?? null,
        },
      },
    });
  }

  private async applyAsignacion(input: {
    clienteId: string;
    oportunidadId: string;
    asesorId: string;
    regla: "sede_disponibilidad_round_robin" | "cola_coordinador" | "manual";
    actor: "sistema" | "coordinador" | "admin";
    actorUsuarioId?: string;
    motivo?: string;
  }): Promise<void> {
    const prisma = this.prisma!;
    const usuario = await prisma.usuario.findUnique({
      where: { id: input.asesorId },
      select: { id: true },
    });
    if (!usuario) return;

    await prisma.asignacion.updateMany({
      where: { oportunidadId: input.oportunidadId, vigente: true },
      data: { vigente: false },
    });
    await prisma.asignacion.create({
      data: {
        clienteId: input.clienteId,
        oportunidadId: input.oportunidadId,
        usuarioDestinoId: input.asesorId,
        regla: input.regla,
        actor: input.actor,
        actorUsuarioId: input.actorUsuarioId,
        motivo: input.motivo,
        vigente: true,
      },
    });
    await prisma.cliente.update({
      where: { id: input.clienteId },
      data: { asesorAsignadoId: input.asesorId },
    });
    await prisma.oportunidad.update({
      where: { id: input.oportunidadId },
      data: { asesorAsignadoId: input.asesorId },
    });
    await prisma.interaccion.create({
      data: {
        clienteId: input.clienteId,
        oportunidadId: input.oportunidadId,
        tipo: "asignacion",
        actor: "sistema",
        resumen: "Asesor asignado",
        payload: {
          asesorId: input.asesorId,
          regla: input.regla,
        },
      },
    });
  }
}

export function mapCanal(canal: string): Canal {
  return mapCanalCrm(canal);
}

export function mapTipoEvento(tipo?: string | null): TipoEvento | undefined {
  if (!tipo) return undefined;
  const t = tipo.toLowerCase() as TipoEvento;
  return TIPOS_EVENTO.has(t) ? t : undefined;
}

type OppPrevLite = {
  visitaEstado?: VisitaEstado;
  intencionVisita?: boolean;
  etapa?: EtapaPipeline;
  propuestaEnviadaEn?: Date | null;
  paqueteTentativoId?: string | null;
  calificacion?: string;
} | null;

function buildIdentityWrite(
  mode: "create" | "update",
  existing: {
    nombre?: string | null;
    telefono?: string | null;
    correo?: string | null;
    nombrePerfilCanal?: string | null;
  } | null | undefined,
  display: {
    nombre: string | null;
    telefono: string | null;
    nombrePerfilCanal: string | null;
    correo: string | null;
  },
): {
  nombre?: string | null;
  telefono?: string | null;
  correo?: string | null;
  nombrePerfilCanal?: string | null;
} {
  const current = existing ?? null;
  const harvested = display.nombre;
  const perfil = display.nombrePerfilCanal;
  const existingNombre = current?.nombre?.trim() || null;
  let nombre: string | null | undefined;
  if (harvested) nombre = harvested;
  else if (existingNombre) nombre = mode === "update" ? undefined : existingNombre;
  else if (perfil) nombre = perfil;
  else nombre = mode === "update" ? undefined : null;

  const fields: {
    nombre?: string | null;
    telefono?: string | null;
    correo?: string | null;
    nombrePerfilCanal?: string | null;
  } = {};
  if (nombre !== undefined) fields.nombre = nombre;
  if (perfil) fields.nombrePerfilCanal = perfil;
  else if (mode === "create") fields.nombrePerfilCanal = null;
  if (display.telefono) fields.telefono = display.telefono;
  else if (mode === "create") fields.telefono = null;

  const existingCorreo = current?.correo?.trim() || null;
  if (display.correo && !existingCorreo) fields.correo = display.correo;
  else if (mode === "create") fields.correo = display.correo;
  return fields;
}

function comercialFromTurn(input: {
  conv: ConversacionState;
  prev: OppPrevLite;
  paqueteId: string | null;
  tipoEvento: TipoEvento | null;
  fechaTentativa: Date | null;
  sedeNombre: string | null;
}): {
  intencionVisita: boolean;
  visitaEstado: VisitaEstado;
  etapa: EtapaPipeline;
  etapaCotizacion: EtapaCotizacion;
  visitaChanged: boolean;
  etapaChanged: boolean;
} {
  const prevVisita = input.prev?.visitaEstado ?? "no_solicitada";
  const intencionVisita =
    Boolean(input.prev?.intencionVisita) ||
    Boolean(input.conv.camposCapturados.intencionVisita);
  let visitaEstado: VisitaEstado = prevVisita;
  if (intencionVisita && visitaEstado === "no_solicitada") {
    visitaEstado = "solicitada";
  }
  const etapa = nextEtapaPipeline(input.prev?.etapa, input.conv.calificado);
  const perfilCompleto = isPerfilListo(input.conv.camposCapturados);
  const intel = derivarInteligencia({
    tipoEvento: input.tipoEvento,
    calificacion: input.conv.calificado ? "calificado" : "en_exploracion",
    listoParaCotizar: input.conv.listoParaCotizar,
    paqueteTentativoId:
      input.paqueteId ?? input.prev?.paqueteTentativoId ?? null,
    etapa,
    propuestaEnviadaEn: input.prev?.propuestaEnviadaEn ?? null,
    visitaEstado,
    intencionVisita,
    motivoHandoff: input.conv.motivoHandoff,
    ultimaRuta: input.conv.ultimaRuta,
    pasoGuion: input.conv.pasoGuion,
    perfilCompleto,
    intencionCotizar: input.conv.camposCapturados.intencionCotizar ?? null,
    pedidoCotizacion: input.conv.pedidoCotizacion ?? null,
    ultimoContactoEn: new Date(),
    estadoAtencion: mapEstadoAtencion(input.conv.estadoBot),
  });
  return {
    intencionVisita,
    visitaEstado,
    etapa,
    etapaCotizacion: intel.etapaCotizacion,
    visitaChanged: visitaEstado !== prevVisita,
    etapaChanged: etapa !== (input.prev?.etapa ?? "nuevo_bot"),
  };
}

function consultaFromBrief(brief: unknown): {
  id: string;
  tool?: unknown;
  input?: unknown;
  filasSku?: unknown;
  ok?: unknown;
  creadoEn?: unknown;
} | null {
  if (!brief || typeof brief !== "object" || Array.isArray(brief)) return null;
  const snap = (brief as Record<string, unknown>).consultaCatalogoAlMomento;
  if (!snap || typeof snap !== "object" || Array.isArray(snap)) return null;
  const id = (snap as { id?: unknown }).id;
  if (typeof id !== "string" || !id) return null;
  return snap as { id: string };
}

function camposToJson(campos: CamposCapturados): Prisma.InputJsonValue {
  const nombre =
    campos.nombre && looksLikePersonName(campos.nombre)
      ? campos.nombre
      : null;
  return {
    telefono: campos.telefono ?? null,
    nombre,
    fechaTentativa: campos.fechaTentativa ?? null,
    tipoEvento: campos.tipoEvento ?? null,
    aforo: campos.aforo ?? null,
    sedeId: campos.sedeId ?? null,
    sedeNombre: campos.sedeNombre ?? null,
    presupuestoOrientativo: campos.presupuestoOrientativo ?? null,
    intencionCotizar: campos.intencionCotizar ?? null,
    intencionVisita: campos.intencionVisita ?? null,
    encajeEconomico: campos.encajeEconomico ?? null,
    intencionNivel: campos.intencionNivel ?? null,
    rangoInversion: campos.rangoInversion ?? null,
    aceptaPiso250k: campos.aceptaPiso250k ?? null,
    fechaEstado: campos.fechaEstado ?? null,
    rutaComercial: campos.rutaComercial ?? null,
    consentimientoSeguimiento: campos.consentimientoSeguimiento ?? null,
    numeroAclaracionesPiso: campos.numeroAclaracionesPiso ?? null,
    numeroMensajesCaptura: campos.numeroMensajesCaptura ?? null,
    fechaTipo: campos.fechaTipo ?? null,
    ventanaVisita: campos.ventanaVisita ?? null,
    aforoBanda: campos.aforoBanda ?? null,
    origenZona: campos.origenZona ?? null,
    email: campos.email ?? null,
    pdfEnviado: campos.pdfEnviado ?? null,
    adjuntoReintentos: campos.adjuntoReintentos ?? null,
    ctaGuion: campos.ctaGuion ?? null,
    rangoPresupuestoFuera: campos.rangoPresupuestoFuera ?? null,
  } as Prisma.InputJsonValue;
}

function camposFromStored(json: unknown): CamposCapturados {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  return json as CamposCapturados;
}

function pedidoFromPayload(payload: unknown): boolean | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const p = payload as Record<string, unknown>;
  if ("pedido" in p) return Boolean(p.pedido);
  if (p.listoParaCotizar === true) return true;
  return null;
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function uniqueDups(
  dups: Array<{ tipo: string; valor: string; otroClienteId: string }>,
) {
  const seen = new Set<string>();
  const out = [];
  for (const d of dups) {
    const k = `${d.tipo}:${d.valor}:${d.otroClienteId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  return out;
}
