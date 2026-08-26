import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { PanelUser } from "../auth/auth.types";
import { toOportunidadResumen } from "./cliente.mapper";
import type { ActualizarOportunidadDto } from "./dto/oportunidad.dto";
import {
  derivarInteligencia,
  perfilDesdeOportunidad,
} from "./inteligencia/playbook-evento";

@Injectable()
export class OportunidadService {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async update(actor: PanelUser, id: string, dto: ActualizarOportunidadDto) {
    this.assertDb();
    const opp = await this.prisma!.oportunidad.findFirst({
      where: { id, cliente: this.clienteScope(actor) },
      include: {
        cliente: true,
        conversaciones: { orderBy: { actualizadoEn: "desc" as const }, take: 1 },
      },
    });
    if (!opp) throw new NotFoundException("OPORTUNIDAD_NOT_FOUND");
    if (
      actor.role === "asesor" &&
      opp.cliente.asesorAsignadoId &&
      opp.cliente.asesorAsignadoId !== actor.userId
    ) {
      throw new ForbiddenException();
    }
    if (dto.etapa === "perdido" && !dto.motivoPerdido && !opp.motivoPerdido) {
      throw new BadRequestException("MOTIVO_PERDIDO_REQUERIDO");
    }

    const actorCrm =
      actor.role === "asesor" ? "asesor" : actor.role;
    const data: Prisma.OportunidadUpdateInput = {};
    const hechos: Array<{
      tipo: "cambio_visita" | "propuesta_enviada" | "cambio_etapa";
      resumen: string;
      payload: Prisma.InputJsonValue;
    }> = [];

    if (dto.visitaEstado) {
      data.visitaEstado = dto.visitaEstado;
      if (dto.visitaEstado !== "no_solicitada") data.intencionVisita = true;
      hechos.push({
        tipo: "cambio_visita",
        resumen: `Visita → ${dto.visitaEstado}`,
        payload: {
          de: opp.visitaEstado,
          a: dto.visitaEstado,
          visitaAgendadaEn: dto.visitaAgendadaEn ?? null,
        },
      });
    }
    if (dto.visitaAgendadaEn !== undefined) {
      data.visitaAgendadaEn = dto.visitaAgendadaEn
        ? new Date(dto.visitaAgendadaEn)
        : null;
    }
    if (dto.visitaNotas !== undefined) data.visitaNotas = dto.visitaNotas;

    if (dto.marcarPropuestaEnviada) {
      const ahora = new Date();
      data.propuestaEnviadaEn = ahora;
      if (
        opp.etapa === "nuevo_bot" ||
        opp.etapa === "calificado" ||
        opp.etapa === "contactado"
      ) {
        data.etapa = "propuesta";
        hechos.push({
          tipo: "cambio_etapa",
          resumen: "Etapa → propuesta",
          payload: { de: opp.etapa, a: "propuesta" },
        });
      }
      hechos.push({
        tipo: "propuesta_enviada",
        resumen: "Propuesta enviada",
        payload: { propuestaEnviadaEn: ahora.toISOString() },
      });
    }

    if (dto.etapa && dto.etapa !== opp.etapa) {
      data.etapa = dto.etapa;
      hechos.push({
        tipo: "cambio_etapa",
        resumen: `Etapa → ${dto.etapa}`,
        payload: { de: opp.etapa, a: dto.etapa },
      });
    }
    if (dto.motivoPerdido !== undefined) data.motivoPerdido = dto.motivoPerdido;

    const nextEtapa =
      (data.etapa as typeof opp.etapa | undefined) ?? opp.etapa;
    const nextVisita =
      (data.visitaEstado as typeof opp.visitaEstado | undefined) ??
      opp.visitaEstado;
    const nextPropuesta =
      dto.marcarPropuestaEnviada
        ? new Date()
        : opp.propuestaEnviadaEn;
    const conv = opp.conversaciones[0];
    const intel = derivarInteligencia({
      tipoEvento: opp.tipoEvento,
      calificacion: opp.calificacion,
      listoParaCotizar: opp.listoParaCotizar,
      paqueteTentativoId: opp.paqueteTentativoId,
      etapa: nextEtapa,
      propuestaEnviadaEn: nextPropuesta,
      visitaEstado: nextVisita,
      intencionVisita:
        Boolean(data.intencionVisita) || opp.intencionVisita,
      motivoHandoff: conv?.motivoHandoff ?? null,
      ultimaRuta: conv?.ultimaRuta ?? null,
      pasoGuion: conv?.pasoGuion ?? null,
      perfilCompleto: perfilDesdeOportunidad({
        tipoEvento: opp.tipoEvento,
        fechaTentativa: opp.fechaTentativa,
        aforo: opp.aforo,
        sede: opp.sede,
      }),
      ultimoContactoEn: opp.cliente.ultimoContactoEn,
      estadoAtencion: opp.cliente.estadoAtencion,
    });
    data.etapaCotizacion = intel.etapaCotizacion;

    const updated = await this.prisma!.oportunidad.update({
      where: { id: opp.id },
      data,
    });
    for (const hecho of hechos) {
      await this.prisma!.interaccion.create({
        data: {
          clienteId: opp.clienteId,
          oportunidadId: opp.id,
          tipo: hecho.tipo,
          actor: actorCrm,
          resumen: hecho.resumen,
          payload: hecho.payload,
        },
      });
    }
    return {
      data: toOportunidadResumen(updated, {
        ultimoContactoEn: opp.cliente.ultimoContactoEn,
        estadoAtencion: opp.cliente.estadoAtencion,
        conv,
      }),
    };
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
      OR: [
        { sedeInteresId: { in: actor.sedeIds } },
        { sedeInteresId: null },
      ],
    };
  }

  private assertDb(): void {
    if (!this.prisma) throw new NotFoundException("OPORTUNIDAD_NOT_FOUND");
  }
}
