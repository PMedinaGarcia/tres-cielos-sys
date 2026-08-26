import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { PanelUser } from "../auth/auth.types";
import {
  toClienteDetail,
  toClienteListItem,
  toInteraccionDto,
} from "./cliente.mapper";
import { IdentidadService, searchFingerprints } from "./identidad.service";
import type {
  ActualizarClienteDto,
  CrearNotaClienteDto,
  HistorialQueryDto,
  ListClientesQueryDto,
  ReemplazarTagsDto,
} from "./dto/cliente.dto";
import type { HistorialItemDto, TipoInteraccion, ColaCrm } from "@tres-cielos/shared";
import { ESTANCAMIENTO_MS } from "./inteligencia/playbook-evento";

const HECHOS_HISTORIAL: TipoInteraccion[] = [
  "nota",
  "cambio_estado_atencion",
  "cambio_etapa",
  "handoff",
  "toma_control",
  "asignacion",
  "accion_bot",
  "edicion_ficha",
  "posible_duplicado",
  "recontacto",
  "intencion_cotizar",
  "brief_actualizado",
  "cambio_visita",
  "propuesta_enviada",
];

const MAX_HISTORIAL = 2000;

const detailInclude = {
  identificadores: { orderBy: { creadoEn: "asc" as const } },
  tags: { include: { tag: true } },
  notas: { orderBy: { creadoEn: "desc" as const }, take: 50 },
  oportunidades: { orderBy: { actualizadoEn: "desc" as const } },
  conversaciones: { orderBy: { actualizadoEn: "desc" as const } },
} satisfies Prisma.ClienteInclude;

@Injectable()
export class ClienteService {
  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly identidad?: IdentidadService,
  ) {}

  async list(actor: PanelUser, query: ListClientesQueryDto) {
    this.assertDb();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ClienteWhereInput = {
      AND: [this.scopeWhere(actor), this.filtersWhere(query)],
    };
    const [rows, total] = await Promise.all([
      this.prisma!.cliente.findMany({
        where,
        include: {
          tags: { include: { tag: true } },
          oportunidades: { orderBy: { actualizadoEn: "desc" as const }, take: 1 },
        },
        orderBy: { ultimoContactoEn: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma!.cliente.count({ where }),
    ]);
    const flagged =
      (await this.identidad?.clienteIdsConDuplicado(rows.map((r) => r.id))) ??
      new Set<string>();
    return {
      data: rows.map((row) => toClienteListItem(row, flagged.has(row.id))),
      meta: { page, pageSize, total },
    };
  }

  async getById(actor: PanelUser, id: string) {
    this.assertDb();
    const row = await this.prisma!.cliente.findFirst({
      where: { id, AND: [this.scopeWhere(actor)] },
      include: detailInclude,
    });
    if (!row) throw new NotFoundException("CLIENTE_NOT_FOUND");
    const vinculos = (await this.identidad?.vinculosFor(row.id)) ?? [];
    const flagged =
      (await this.identidad?.clienteIdsConDuplicado([row.id])) ??
      new Set<string>();
    return {
      data: toClienteDetail(row, {
        vinculos,
        tieneDuplicado: flagged.has(row.id) || vinculos.length > 0,
      }),
    };
  }

  async update(actor: PanelUser, id: string, dto: ActualizarClienteDto) {
    this.assertDb();
    const existing = await this.requireScoped(actor, id);
    const data: Prisma.ClienteUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre.trim();
    if (dto.correo !== undefined) {
      data.correo = dto.correo ? dto.correo.toLowerCase().trim() : null;
    }
    if (dto.optOutMensajeria !== undefined) {
      data.optOutMensajeria = dto.optOutMensajeria;
    }
    if (dto.idioma !== undefined) data.idioma = dto.idioma;
    if (dto.zonaHoraria !== undefined) data.zonaHoraria = dto.zonaHoraria;
    if (dto.sedeInteresId !== undefined) {
      data.sedeInteres = dto.sedeInteresId
        ? { connect: { id: dto.sedeInteresId } }
        : { disconnect: true };
    }
    const updated = await this.prisma!.cliente.update({
      where: { id: existing.id },
      data,
      include: detailInclude,
    });
    await this.prisma!.interaccion.create({
      data: {
        clienteId: existing.id,
        tipo: "edicion_ficha",
        actor: actor.role === "asesor" ? "asesor" : actor.role,
        resumen: "Ficha de cliente actualizada",
        payload: { campos: Object.keys(dto), usuarioId: actor.userId },
      },
    });
    if (dto.correo) {
      await this.upsertEmailIdentificador(existing.id, dto.correo);
    }
    return { data: toClienteDetail(updated, { vinculos: await this.vinculosSafe(existing.id) }) };
  }

  async timeline(
    actor: PanelUser,
    id: string,
    page = 1,
    pageSize = 50,
  ) {
    this.assertDb();
    await this.requireScoped(actor, id);
    const where = { clienteId: id };
    const [rows, total] = await Promise.all([
      this.prisma!.interaccion.findMany({
        where,
        orderBy: { creadoEn: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma!.interaccion.count({ where }),
    ]);
    return {
      data: rows.map(toInteraccionDto),
      meta: { page, pageSize, total },
    };
  }

  async historial(
    actor: PanelUser,
    id: string,
    query: HistorialQueryDto = {},
  ) {
    this.assertDb();
    await this.requireScoped(actor, id);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    const vinculos = await this.vinculosSafe(id);
    const linkedIds = vinculos.map((v) => v.clienteId);
    const allClienteIds = [id, ...linkedIds];
    const tipoFiltro = query.tipo?.trim() as TipoInteraccion | undefined;

    const hechoTipos: TipoInteraccion[] =
      tipoFiltro && HECHOS_HISTORIAL.includes(tipoFiltro)
        ? [tipoFiltro]
        : tipoFiltro
          ? []
          : HECHOS_HISTORIAL;

    const mensajes = await this.prisma!.mensaje.findMany({
      where: {
        conversacion: { clienteId: { in: allClienteIds } },
      },
      include: {
        adjuntos: true,
        conversacion: { select: { clienteId: true, canal: true } },
      },
      orderBy: { creadoEn: "asc" },
      take: MAX_HISTORIAL,
    });

    const hechos = hechoTipos.length
      ? await this.prisma!.interaccion.findMany({
          where: {
            clienteId: { in: allClienteIds },
            tipo: { in: hechoTipos },
          },
          orderBy: { creadoEn: "asc" },
          take: MAX_HISTORIAL,
        })
      : [];

    const items: HistorialItemDto[] = [];
    const seenMensajes = new Set<string>();

    const includeMensajes =
      !tipoFiltro || tipoFiltro === "mensaje" || tipoFiltro === "plantilla" || tipoFiltro === "adjunto";

    if (includeMensajes) {
      for (const msg of mensajes) {
        if (tipoFiltro === "plantilla" && !msg.plantillaUtilityId) continue;
        if (tipoFiltro === "adjunto" && msg.adjuntos.length === 0) continue;
        if (tipoFiltro === "mensaje" && msg.plantillaUtilityId) continue;
        if (seenMensajes.has(msg.id)) continue;
        seenMensajes.add(msg.id);
        const propio = msg.conversacion.clienteId === id;
        items.push({
          id: `msg:${msg.id}`,
          kind: "mensaje",
          tipo: msg.plantillaUtilityId ? "plantilla" : "mensaje",
          actor: msg.autor,
          canal: msg.canal,
          creadoEn: msg.creadoEn.toISOString(),
          contenido: msg.contenido,
          conversacionId: msg.conversacionId,
          mensajeId: msg.id,
          oportunidadId: null,
          vinculo: propio ? "propio" : "posible_duplicado",
          vinculoClienteId: propio ? null : msg.conversacion.clienteId,
          direccion: msg.direccion,
          autorMensaje: msg.autor,
          adjuntos: msg.adjuntos.map((a) => ({
            mimeType: a.mimeType,
            nombreOriginal: a.nombreOriginal,
          })),
        });
      }
    }

    if (!tipoFiltro || HECHOS_HISTORIAL.includes(tipoFiltro)) {
      for (const hecho of hechos) {
        const propio = hecho.clienteId === id;
        items.push({
          id: `hecho:${hecho.id}`,
          kind: "hecho",
          tipo: hecho.tipo,
          actor: hecho.actor,
          canal: hecho.canal,
          creadoEn: hecho.creadoEn.toISOString(),
          contenido: hecho.resumen,
          conversacionId: hecho.conversacionId,
          mensajeId: hecho.mensajeId,
          oportunidadId: hecho.oportunidadId,
          vinculo: propio ? "propio" : "posible_duplicado",
          vinculoClienteId: propio ? null : hecho.clienteId,
          direccion: null,
          autorMensaje: null,
          adjuntos: [],
          payload: hecho.payload,
        });
      }
    }

    items.sort(
      (a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime(),
    );
    const total = items.length;
    const start = (page - 1) * pageSize;
    return {
      data: items.slice(start, start + pageSize),
      meta: { page, pageSize, total },
    };
  }

  async addNota(actor: PanelUser, id: string, dto: CrearNotaClienteDto) {
    this.assertDb();
    const cliente = await this.requireScoped(actor, id);
    const nota = await this.prisma!.notaCliente.create({
      data: {
        clienteId: cliente.id,
        autorId: actor.userId,
        cuerpo: dto.cuerpo.trim(),
      },
    });
    await this.prisma!.interaccion.create({
      data: {
        clienteId: cliente.id,
        tipo: "nota",
        actor: actor.role === "asesor" ? "asesor" : actor.role,
        resumen: dto.cuerpo.trim().slice(0, 180),
        payload: { notaId: nota.id, autorId: actor.userId },
      },
    });
    return {
      data: {
        id: nota.id,
        autorId: nota.autorId,
        cuerpo: nota.cuerpo,
        creadoEn: nota.creadoEn.toISOString(),
      },
    };
  }

  async replaceTags(actor: PanelUser, id: string, dto: ReemplazarTagsDto) {
    this.assertDb();
    const cliente = await this.requireScoped(actor, id);
    const names = [
      ...new Set(
        dto.tags
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0)
          .slice(0, 30),
      ),
    ];
    const tags = await Promise.all(
      names.map((nombre) =>
        this.prisma!.tag.upsert({
          where: { nombre },
          create: { nombre },
          update: {},
        }),
      ),
    );
    await this.prisma!.clienteTag.deleteMany({
      where: { clienteId: cliente.id },
    });
    if (tags.length) {
      await this.prisma!.clienteTag.createMany({
        data: tags.map((t) => ({ clienteId: cliente.id, tagId: t.id })),
      });
    }
    await this.prisma!.interaccion.create({
      data: {
        clienteId: cliente.id,
        tipo: "edicion_ficha",
        actor: actor.role === "asesor" ? "asesor" : actor.role,
        resumen: "Tags actualizados",
        payload: { tags: names, usuarioId: actor.userId },
      },
    });
    const row = await this.prisma!.cliente.findUniqueOrThrow({
      where: { id: cliente.id },
      include: detailInclude,
    });
    return { data: toClienteDetail(row, { vinculos: await this.vinculosSafe(cliente.id) }) };
  }

  private async upsertEmailIdentificador(clienteId: string, correo: string) {
    const valor = correo.toLowerCase().trim();
    const owned = await this.prisma!.identificadorCliente.findUnique({
      where: {
        tipo_valorNormalizado: { tipo: "email", valorNormalizado: valor },
      },
    });
    if (owned && owned.clienteId !== clienteId) {
      await this.prisma!.interaccion.create({
        data: {
          clienteId,
          tipo: "posible_duplicado",
          actor: "sistema",
          resumen: "Correo ya pertenece a otro cliente",
          payload: { tipo: "email", valor, otroClienteId: owned.clienteId },
        },
      });
      return;
    }
    if (!owned) {
      await this.prisma!.identificadorCliente.create({
        data: {
          clienteId,
          tipo: "email",
          valor,
          valorNormalizado: valor,
        },
      });
    }
  }

  private async requireScoped(actor: PanelUser, id: string) {
    const row = await this.prisma!.cliente.findFirst({
      where: { id, AND: [this.scopeWhere(actor)] },
    });
    if (!row) throw new NotFoundException("CLIENTE_NOT_FOUND");
    if (
      actor.role === "asesor" &&
      row.asesorAsignadoId &&
      row.asesorAsignadoId !== actor.userId
    ) {
      throw new ForbiddenException();
    }
    return row;
  }

  private scopeWhere(actor: PanelUser): Prisma.ClienteWhereInput {
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

  private filtersWhere(query: ListClientesQueryDto): Prisma.ClienteWhereInput {
    const and: Prisma.ClienteWhereInput[] = [];
    if (query.estadoAtencion) and.push({ estadoAtencion: query.estadoAtencion });
    if (query.sinAsignar) and.push({ asesorAsignadoId: null });
    else if (query.asesorId) and.push({ asesorAsignadoId: query.asesorId });
    if (query.tipoEvento) {
      and.push({
        oportunidades: { some: { tipoEvento: query.tipoEvento } },
      });
    }
    if (query.etapaCotizacion) {
      and.push({
        oportunidades: { some: { etapaCotizacion: query.etapaCotizacion } },
      });
    }
    if (query.visitaEstado) {
      and.push({
        oportunidades: { some: { visitaEstado: query.visitaEstado } },
      });
    }
    if (query.cola) {
      and.push(colaWhere(query.cola));
    }
    if (query.tag) {
      and.push({
        tags: { some: { tag: { nombre: query.tag.trim().toLowerCase() } } },
      });
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      const fps = searchFingerprints(q);
      const identOr: Prisma.ClienteWhereInput[] = [
        { nombre: { contains: q, mode: "insensitive" } },
        { telefono: { contains: q } },
        { correo: { contains: q, mode: "insensitive" } },
        {
          identificadores: {
            some: {
              OR: [
                { valor: { contains: q, mode: "insensitive" } },
                { valorNormalizado: { contains: q.toLowerCase() } },
              ],
            },
          },
        },
      ];
      if (fps.length) {
        identOr.push({
          identificadores: {
            some: {
              tipo: { in: ["telefono", "wa_id"] },
              valorNormalizado: { in: fps },
            },
          },
        });
      }
      and.push({ OR: identOr });
    }
    return and.length ? { AND: and } : {};
  }

  private async vinculosSafe(clienteId: string) {
    return (await this.identidad?.vinculosFor(clienteId)) ?? [];
  }

  private assertDb(): void {
    if (!this.prisma) throw new NotFoundException("CLIENTE_NOT_FOUND");
  }
}

function colaWhere(cola: ColaCrm): Prisma.ClienteWhereInput {
  const cutoff = new Date(Date.now() - ESTANCAMIENTO_MS);
  switch (cola) {
    case "visitas_sin_agendar":
      return { oportunidades: { some: { visitaEstado: "solicitada" } } };
    case "listos_sin_propuesta":
      return {
        oportunidades: { some: { etapaCotizacion: "listo_para_cotizar" } },
      };
    case "sin_tarifa":
      return { oportunidades: { some: { etapaCotizacion: "sin_tarifa" } } };
    case "escalados":
      return { estadoAtencion: "escalado" };
    case "estancados":
      return {
        ultimoContactoEn: { lt: cutoff },
        estadoAtencion: { not: "cerrado" },
        NOT: {
          oportunidades: {
            some: { etapaCotizacion: { in: ["ganado", "perdido"] } },
          },
        },
      };
    default:
      return {};
  }
}
