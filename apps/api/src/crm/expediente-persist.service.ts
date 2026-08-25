import { Injectable, Logger, Optional } from "@nestjs/common";
import type { Canal, PasoGuion, TipoEvento } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { fechaTentativaToIso } from "../conversation/script/fecha-tentativa.parser";
import type { CamposCapturados, ConversacionState } from "../conversation/types";
import { resolveTelefonoCanal } from "../conversation/telefono";

const TIPOS_EVENTO = new Set<TipoEvento>([
  "boda",
  "xv",
  "corporativo",
  "social",
  "otro",
  "multi",
]);

@Injectable()
export class ExpedientePersistService {
  private readonly logger = new Logger(ExpedientePersistService.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async persistAfterTurn(conv: ConversacionState): Promise<void> {
    if (!this.canWrite()) return;
    try {
      await this.upsert(conv);
    } catch (err) {
      this.logger.warn(
        `No se pudo persistir expediente ${conv.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private canWrite(): boolean {
    return Boolean(this.prisma && process.env.DATABASE_URL);
  }

  private async upsert(conv: ConversacionState): Promise<void> {
    const prisma = this.prisma!;
    const canal = mapCanal(conv.canal);
    const campos = conv.camposCapturados;
    const telefono =
      campos.telefono ??
      resolveTelefonoCanal({ externalThreadId: conv.externalThreadId });
    const fechaIso = fechaTentativaToIso(campos.fechaTentativa ?? null);
    const tipoEvento = mapTipoEvento(campos.tipoEvento);

    const existing = await prisma.conversacion.findUnique({
      where: {
        canal_externalThreadId: {
          canal,
          externalThreadId: conv.externalThreadId,
        },
      },
      include: { oportunidad: { include: { lead: true } } },
    });

    const lead = await this.upsertLead(existing?.oportunidad.lead.id, {
      nombre: campos.nombre ?? null,
      telefono,
    });

    const oppData = {
      tipoEvento: tipoEvento ?? null,
      fechaTentativa: fechaIso ? new Date(`${fechaIso}T12:00:00.000Z`) : null,
      fechaFlexible: Boolean(campos.fechaTentativa?.flexible),
      aforo: campos.aforo ?? null,
      sede: campos.sedeNombre ?? null,
      briefJson: (conv.brief ?? {}) as object,
      calificacion: conv.calificado ? ("calificado" as const) : ("en_exploracion" as const),
      listoParaCotizar: conv.listoParaCotizar,
      canalOrigen: canal,
    };

    if (existing) {
      if (existing.oportunidad.leadId !== lead.id) {
        await prisma.oportunidad.update({
          where: { id: existing.oportunidadId },
          data: { leadId: lead.id, ...oppData },
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
          pasoGuion: conv.pasoGuion as PasoGuion,
          camposCapturados: camposToJson(campos),
          estadoBot: conv.estadoBot,
          sede: campos.sedeNombre ?? null,
        },
      });
      return;
    }

    const opp = await prisma.oportunidad.create({
      data: {
        id: conv.oportunidadId,
        leadId: lead.id,
        ...oppData,
      },
    });

    await prisma.conversacion.create({
      data: {
        id: conv.id,
        oportunidadId: opp.id,
        canal,
        externalThreadId: conv.externalThreadId,
        estadoBot: conv.estadoBot,
        pasoGuion: conv.pasoGuion as PasoGuion,
        camposCapturados: camposToJson(campos),
        sede: campos.sedeNombre ?? null,
      },
    });
  }

  private async upsertLead(
    existingLeadId: string | undefined,
    input: { nombre: string | null; telefono: string | null },
  ) {
    const prisma = this.prisma!;
    if (existingLeadId) {
      return prisma.lead.update({
        where: { id: existingLeadId },
        data: {
          nombre: input.nombre ?? undefined,
          telefono: input.telefono ?? undefined,
          waId: input.telefono ?? undefined,
          ultimoContactoEn: new Date(),
        },
      });
    }

    if (input.telefono) {
      const byPhone = await prisma.lead.findFirst({
        where: {
          OR: [{ telefono: input.telefono }, { waId: input.telefono }],
        },
      });
      if (byPhone) {
        return prisma.lead.update({
          where: { id: byPhone.id },
          data: {
            nombre: input.nombre ?? byPhone.nombre,
            telefono: input.telefono,
            waId: input.telefono,
            ultimoContactoEn: new Date(),
          },
        });
      }
    }

    return prisma.lead.create({
      data: {
        nombre: input.nombre,
        telefono: input.telefono,
        waId: input.telefono,
      },
    });
  }
}

export function mapCanal(canal: string): Canal {
  const c = canal.toLowerCase();
  if (c === "whatsapp") return "whatsapp";
  if (c === "instagram") return "instagram";
  if (c === "facebook" || c === "messenger") return "facebook";
  return "sandbox";
}

export function mapTipoEvento(tipo?: string | null): TipoEvento | undefined {
  if (!tipo) return undefined;
  const t = tipo.toLowerCase() as TipoEvento;
  return TIPOS_EVENTO.has(t) ? t : undefined;
}

function camposToJson(campos: CamposCapturados): object {
  return {
    telefono: campos.telefono ?? null,
    nombre: campos.nombre ?? null,
    fechaTentativa: campos.fechaTentativa ?? null,
    tipoEvento: campos.tipoEvento ?? null,
    aforo: campos.aforo ?? null,
    sedeId: campos.sedeId ?? null,
    sedeNombre: campos.sedeNombre ?? null,
    presupuestoOrientativo: campos.presupuestoOrientativo ?? null,
    intencionCotizar: campos.intencionCotizar ?? null,
  };
}
