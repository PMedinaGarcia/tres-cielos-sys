import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { SEDE_ID } from "@tres-cielos/shared";
import type { PanelUser } from "../auth/auth.types";
import { AsesorAlertService } from "../notifications/asesor-alert.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { elegirAsesor, type DecisionAsignacion } from "./elegir-asesor";
import { dentroDeHorario, inicioDelDia } from "./reloj-sede";

const BARRIDO_MS = 30_000;

export type DisparadorAsignar =
  | "calificado"
  | "handoff"
  | "recontacto"
  | "sla"
  | "manual"
  | "drenado"
  | "exploracion";

export interface AsignarInput {
  oportunidadId: string;
  disparador: DisparadorAsignar;
  asesorId?: string;
  actor?: "sistema" | "coordinador" | "admin";
  actorUsuarioId?: string;
  motivo?: string;
  excluirAsesorId?: string;
}

export interface AsignarResult {
  estado: "asignado" | "conservado" | "en_cola" | "omitido";
  asesorId: string | null;
  motivoCola:
    | "sin_disponibles"
    | "todos_en_tope"
    | "en_exploracion"
    | "dueno_inactivo"
    | null;
  sedeId: string | null;
  conversacionId: string | null;
  clienteId: string | null;
  creadaCola: boolean;
}

type Tx = Prisma.TransactionClient;

const ETAPAS_CERRADAS = ["ganado", "perdido"] as const;

/**
 * Único escritor del dueño comercial.
 * Un advisory lock por sede evita que dos réplicas elijan al mismo asesor.
 */
@Injectable()
export class AssignmentEngine implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssignmentEngine.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private corriendo = false;
  private readonly slaAvisados = new Set<string>();

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly alertas?: AsesorAlertService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  onModuleInit(): void {
    if (process.env.JEST_WORKER_ID) return;
    if (!this.puedeEscribir()) return;
    void this.drenarHistoricos().catch((err) => this.fallo("drenado inicial", err));
    this.timer = setInterval(() => {
      void this.barrido().catch((err) => this.fallo("barrido", err));
    }, BARRIDO_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async asignarDesdeTurno(input: {
    oportunidadId: string;
    calificacion: "calificado" | "en_exploracion";
    estadoBot: "activo" | "escalado" | "humano";
    sedeId: string | null;
  }): Promise<AsignarResult | null> {
    if (input.estadoBot === "escalado") {
      return this.asignar({
        oportunidadId: input.oportunidadId,
        disparador: "handoff",
        motivo: "handoff",
      });
    }
    if (input.calificacion === "calificado") {
      return this.asignar({
        oportunidadId: input.oportunidadId,
        disparador: "calificado",
        motivo: "calificado",
      });
    }
    return this.encolarExploracion(input.oportunidadId, input.sedeId);
  }

  async asignar(input: AsignarInput): Promise<AsignarResult | null> {
    if (!this.puedeEscribir()) return null;
    try {
      const result = await this.prisma!.$transaction((tx) => this.asignarEn(tx, input));
      await this.avisar(result);
      return result;
    } catch (err) {
      this.fallo(`asignar ${input.oportunidadId}`, err);
      return null;
    }
  }

  async reasignar(
    actor: PanelUser,
    input: { oportunidadId: string; asesorId: string; motivo?: string },
  ): Promise<AsignarResult> {
    if (!input.oportunidadId || !input.asesorId) {
      throw new BadRequestException("DATOS_INCOMPLETOS");
    }
    if (!this.puedeEscribir()) {
      throw new BadRequestException("ASIGNACION_NO_DISPONIBLE");
    }
    const opp = await this.prisma!.oportunidad.findUnique({
      where: { id: input.oportunidadId },
      select: { id: true, cliente: { select: { sedeInteresId: true } } },
    });
    if (!opp) throw new NotFoundException("OPORTUNIDAD_NOT_FOUND");
    if (actor.sedeIds.length) {
      const sede = opp.cliente.sedeInteresId;
      if (sede && !actor.sedeIds.includes(sede)) {
        throw new NotFoundException("OPORTUNIDAD_NOT_FOUND");
      }
    }
    const destino = await this.prisma!.usuario.findFirst({
      where: { id: input.asesorId, rol: "asesor", activo: true },
      select: { id: true },
    });
    if (!destino) throw new BadRequestException("ASESOR_NO_ELEGIBLE");
    const res = await this.asignar({
      oportunidadId: input.oportunidadId,
      disparador: "manual",
      asesorId: input.asesorId,
      actor: actor.role === "admin" ? "admin" : "coordinador",
      actorUsuarioId: actor.userId,
      motivo: input.motivo ?? "reasignacion_manual",
    });
    if (!res || res.estado !== "asignado") {
      throw new BadRequestException("NO_SE_PUDO_REASIGNAR");
    }
    return res;
  }

  async carga(actor: PanelUser) {
    if (!this.puedeEscribir()) return [];
    const ahora = Date.now();
    const asesores = await this.prisma!.usuario.findMany({
      where: {
        rol: "asesor",
        ...(actor.sedeIds.length
          ? { sedes: { some: { sedeId: { in: actor.sedeIds } } } }
          : {}),
      },
      select: {
        id: true,
        nombre: true,
        disponible: true,
        activo: true,
        oportunidadesAsignadas: {
          where: { etapa: { notIn: [...ETAPAS_CERRADAS] } },
          select: {
            primerContactoHumanoEn: true,
            listoParaCotizar: true,
            etapa: true,
            conversaciones: { select: { estadoBot: true, slaVenceEn: true } },
          },
        },
      },
      orderBy: { nombre: "asc" },
    });
    return asesores.map((asesor) => {
      const abiertas = asesor.oportunidadesAsignadas;
      return {
        asesorId: asesor.id,
        nombre: asesor.nombre,
        disponible: asesor.disponible,
        activo: asesor.activo,
        abiertas: abiertas.length,
        sinContactar: abiertas.filter((o) => !o.primerContactoHumanoEn).length,
        listosSinPropuesta: abiertas.filter(
          (o) =>
            o.listoParaCotizar &&
            o.etapa !== "propuesta" &&
            o.etapa !== "negociacion",
        ).length,
        fueraDeSla: abiertas.filter(
          (o) =>
            !o.primerContactoHumanoEn &&
            o.conversaciones.some(
              (c) =>
                c.estadoBot === "escalado" &&
                c.slaVenceEn != null &&
                c.slaVenceEn.getTime() < ahora,
            ),
        ).length,
      };
    });
  }

  async listarCola(actor: PanelUser) {
    if (!this.puedeEscribir()) return [];
    return this.prisma!.colaAsignacion.findMany({
      where: {
        estado: "esperando",
        ...(actor.sedeIds.length ? { sedeId: { in: actor.sedeIds } } : {}),
      },
      orderBy: { creadoEn: "asc" },
      include: {
        oportunidad: {
          select: {
            id: true,
            clienteId: true,
            calificacion: true,
            tipoEvento: true,
            cliente: { select: { nombre: true } },
          },
        },
      },
    });
  }

  async drenarSede(sedeId: string): Promise<number> {
    if (!this.puedeEscribir()) return 0;
    const filas = await this.prisma!.colaAsignacion.findMany({
      where: {
        sedeId,
        estado: "esperando",
        motivo: { in: ["sin_disponibles", "todos_en_tope", "dueno_inactivo"] },
      },
      orderBy: { creadoEn: "asc" },
      take: 50,
      select: { oportunidadId: true },
    });
    let asignadas = 0;
    for (const fila of filas) {
      const res = await this.asignar({
        oportunidadId: fila.oportunidadId,
        disparador: "drenado",
        motivo: "drenado_cola",
      });
      if (res?.estado === "asignado" || res?.estado === "conservado") asignadas += 1;
    }
    return asignadas;
  }

  async drenarHistoricos(): Promise<number> {
    if (!this.puedeEscribir()) return 0;
    const opps = await this.prisma!.oportunidad.findMany({
      where: {
        asesorAsignadoId: null,
        etapa: { notIn: [...ETAPAS_CERRADAS] },
        OR: [
          { calificacion: "calificado" },
          { conversaciones: { some: { estadoBot: "escalado" } } },
        ],
      },
      select: {
        id: true,
        conversaciones: {
          where: { estadoBot: "escalado" },
          take: 1,
          select: { id: true },
        },
      },
      take: 100,
    });
    let n = 0;
    for (const opp of opps) {
      const escalado = opp.conversaciones.length > 0;
      const res = await this.asignar({
        oportunidadId: opp.id,
        disparador: escalado ? "handoff" : "calificado",
        motivo: "drenado_historico",
      });
      if (res?.estado === "asignado") n += 1;
    }
    return n;
  }

  async marcarPrimerContacto(conversacionId: string): Promise<{
    asesorId: string | null;
    primerContacto: boolean;
  } | null> {
    if (!this.puedeEscribir()) return null;
    const conv = await this.prisma!.conversacion.findUnique({
      where: { id: conversacionId },
      select: {
        id: true,
        escaladoEn: true,
        slaVenceEn: true,
        clienteId: true,
        oportunidadId: true,
        cliente: { select: { asesorAsignadoId: true } },
        oportunidad: {
          select: { primerContactoHumanoEn: true, asesorAsignadoId: true },
        },
      },
    });
    if (!conv) return null;
    const asesorId =
      conv.oportunidad.asesorAsignadoId ?? conv.cliente.asesorAsignadoId;
    if (conv.oportunidad.primerContactoHumanoEn) {
      return { asesorId, primerContacto: false };
    }
    const ahora = new Date();
    await this.prisma!.oportunidad.update({
      where: { id: conv.oportunidadId },
      data: { primerContactoHumanoEn: ahora },
    });
    const latenciaMs = conv.escaladoEn
      ? ahora.getTime() - conv.escaladoEn.getTime()
      : null;
    const fueraDeVentana = conv.slaVenceEn
      ? ahora.getTime() > conv.slaVenceEn.getTime()
      : null;
    await this.prisma!.eventoOperativo.create({
      data: {
        tipo: "primer_mensaje_humano",
        actor: "asesor",
        clienteId: conv.clienteId,
        oportunidadId: conv.oportunidadId,
        conversacionId: conv.id,
        payload: { latenciaMs, fueraDeVentana, asesorId },
      },
    });
    return { asesorId, primerContacto: true };
  }

  async barrido(): Promise<void> {
    if (!this.puedeEscribir() || this.corriendo) return;
    this.corriendo = true;
    try {
      const sedes = await this.prisma!.colaAsignacion.findMany({
        where: {
          estado: "esperando",
          motivo: { in: ["sin_disponibles", "todos_en_tope", "dueno_inactivo"] },
        },
        select: { sedeId: true },
        distinct: ["sedeId"],
      });
      for (const sede of sedes) await this.drenarSede(sede.sedeId);
      await this.vigilarSla();
    } finally {
      this.corriendo = false;
    }
  }

  private async vigilarSla(): Promise<void> {
    const politicas = await this.prisma!.politicaAsignacion.findMany({
      select: { sedeId: true, slaReasignar: true },
    });
    const reasignar = new Set(
      politicas.filter((p) => p.slaReasignar).map((p) => p.sedeId),
    );
    const vencidas = await this.prisma!.oportunidad.findMany({
      where: {
        primerContactoHumanoEn: null,
        asesorAsignadoId: { not: null },
        etapa: { notIn: [...ETAPAS_CERRADAS] },
        conversaciones: {
          some: { slaVenceEn: { lt: new Date() }, estadoBot: "escalado" },
        },
      },
      select: {
        id: true,
        asesorAsignadoId: true,
        cliente: { select: { id: true, sedeInteresId: true } },
        conversaciones: {
          orderBy: { actualizadoEn: "desc" },
          take: 1,
          select: { id: true },
        },
      },
      take: 30,
    });
    for (const opp of vencidas) {
      const sedeId = opp.cliente.sedeInteresId ?? SEDE_ID;
      if (reasignar.has(sedeId)) {
        await this.asignar({
          oportunidadId: opp.id,
          disparador: "sla",
          excluirAsesorId: opp.asesorAsignadoId ?? undefined,
          motivo: "sla_vencido",
        });
        continue;
      }
      if (this.slaAvisados.has(opp.id)) continue;
      this.slaAvisados.add(opp.id);
      const conversacionId = opp.conversaciones[0]?.id ?? null;
      if (!conversacionId) continue;
      await this.alertas?.avisarCola({
        conversacionId,
        sedeId,
        motivo: "sla_vencido",
        clienteId: opp.cliente.id,
      });
    }
  }

  private async encolarExploracion(
    oportunidadId: string,
    sedeHint: string | null,
  ): Promise<AsignarResult | null> {
    if (!this.puedeEscribir()) return null;
    try {
      const result = await this.prisma!.$transaction(async (tx) => {
        const opp = await tx.oportunidad.findUnique({
          where: { id: oportunidadId },
          select: {
            id: true,
            asesorAsignadoId: true,
            cliente: { select: { id: true, sedeInteresId: true } },
            conversaciones: {
              orderBy: { actualizadoEn: "desc" },
              take: 1,
              select: { id: true },
            },
          },
        });
        if (!opp) return omitido();
        if (opp.asesorAsignadoId) {
          return conservado(opp.asesorAsignadoId, opp.cliente.id, opp.conversaciones[0]?.id ?? null, opp.cliente.sedeInteresId);
        }
        const sede = await this.resolverSede(tx, opp.cliente.sedeInteresId ?? sedeHint);
        if (!sede) return omitido(opp.cliente.id);
        const creadaCola = await this.encolar(tx, {
          oportunidadId: opp.id,
          sedeId: sede.id,
          disparador: "exploracion",
          motivo: "en_exploracion",
          detalle: null,
        });
        return {
          estado: "en_cola" as const,
          asesorId: null,
          motivoCola: "en_exploracion" as const,
          sedeId: sede.id,
          conversacionId: opp.conversaciones[0]?.id ?? null,
          clienteId: opp.cliente.id,
          creadaCola,
        };
      });
      return result;
    } catch (err) {
      this.fallo(`exploracion ${oportunidadId}`, err);
      return null;
    }
  }

  private async asignarEn(tx: Tx, input: AsignarInput): Promise<AsignarResult> {
    const opp = await tx.oportunidad.findUnique({
      where: { id: input.oportunidadId },
      include: {
        cliente: {
          select: { id: true, sedeInteresId: true, asesorAsignadoId: true },
        },
        conversaciones: {
          orderBy: { actualizadoEn: "desc" },
          take: 1,
          select: { id: true, cola: true, slaVenceEn: true },
        },
      },
    });
    if (!opp) return omitido();

    const sede = await this.resolverSede(tx, opp.cliente.sedeInteresId);
    if (!sede) return omitido(opp.cliente.id);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"asignacion:" + sede.id}))`;

    const vigente = await tx.asignacion.findFirst({
      where: { oportunidadId: opp.id, vigente: true },
      select: { usuarioDestinoId: true },
    });
    const duenoId = vigente?.usuarioDestinoId ?? opp.asesorAsignadoId;
    const dueno = duenoId
      ? await tx.usuario.findUnique({
          where: { id: duenoId },
          select: { id: true, activo: true },
        })
      : null;
    const convId = opp.conversaciones[0]?.id ?? null;

    if (input.disparador === "manual") {
      if (!input.asesorId) return omitido(opp.cliente.id, sede.id, convId);
      if (dueno?.activo && dueno.id === input.asesorId) {
        return conservado(dueno.id, opp.cliente.id, convId, sede.id);
      }
      const destino = await tx.usuario.findFirst({
        where: { id: input.asesorId, rol: "asesor", activo: true },
        select: { id: true },
      });
      if (!destino) return omitido(opp.cliente.id, sede.id, convId);
      await this.escribir(tx, {
        opp,
        sedeId: sede.id,
        asesorId: destino.id,
        origenId: duenoId,
        regla: "manual",
        actor: input.actor ?? "coordinador",
        actorUsuarioId: input.actorUsuarioId ?? null,
        motivo: input.motivo ?? "reasignacion_manual",
        explicacion: { manual: true },
        slaMinutos: null,
      });
      return asignado(destino.id, opp.cliente.id, convId, sede.id);
    }

    if (input.disparador === "sla") {
      const politica = await this.politicaDe(tx, sede.id);
      const sla = opp.conversaciones[0]?.slaVenceEn ?? null;
      if (
        !politica.slaReasignar ||
        opp.primerContactoHumanoEn ||
        !sla ||
        sla.getTime() > Date.now()
      ) {
        return omitido(opp.cliente.id, sede.id, convId);
      }
    } else if (dueno?.activo) {
      return conservado(dueno.id, opp.cliente.id, convId, sede.id);
    }

    const excluir =
      input.disparador === "sla"
        ? (input.excluirAsesorId ?? duenoId)
        : (input.excluirAsesorId ?? null);

    if (input.disparador !== "sla") {
      const sticky = await this.duenoPrevio(tx, opp.cliente.asesorAsignadoId, sede.id, excluir);
      if (sticky) {
        await this.escribir(tx, {
          opp,
          sedeId: sede.id,
          asesorId: sticky,
          origenId: duenoId,
          regla: "menor_carga_sede",
          actor: "sistema",
          actorUsuarioId: null,
          motivo: "recontacto",
          explicacion: { sticky: true },
          slaMinutos: await this.minutosSla(tx, sede.id, opp.conversaciones[0]?.cola ?? null),
        });
        return asignado(sticky, opp.cliente.id, convId, sede.id);
      }
    }

    const decision = await this.decidir(tx, {
      sede,
      tipoEvento: opp.tipoEvento,
      excluirId: excluir,
    });
    if (!decision.elegidoId) {
      const motivoCola =
        duenoId && !dueno?.activo
          ? "dueno_inactivo"
          : (decision.motivoCola ?? "sin_disponibles");
      if (duenoId) await this.soltarDueno(tx, opp.id, opp.cliente.id);
      const creadaCola = await this.encolar(tx, {
        oportunidadId: opp.id,
        sedeId: sede.id,
        disparador: input.disparador === "exploracion" ? "exploracion" : input.disparador,
        motivo: motivoCola,
        detalle: comoJson(decision.explicacion),
      });
      return {
        estado: "en_cola",
        asesorId: null,
        motivoCola,
        sedeId: sede.id,
        conversacionId: convId,
        clienteId: opp.cliente.id,
        creadaCola,
      };
    }

    const previoInelegible =
      opp.cliente.asesorAsignadoId != null &&
      opp.cliente.asesorAsignadoId !== decision.elegidoId &&
      !dueno?.activo;
    await this.escribir(tx, {
      opp,
      sedeId: sede.id,
      asesorId: decision.elegidoId,
      origenId: duenoId,
      regla: "menor_carga_sede",
      actor: "sistema",
      actorUsuarioId: null,
      motivo: previoInelegible
        ? "dueno_inactivo"
        : (input.motivo ?? input.disparador),
      explicacion: comoJson(decision.explicacion),
      slaMinutos: await this.minutosSla(tx, sede.id, opp.conversaciones[0]?.cola ?? null),
    });
    return asignado(decision.elegidoId, opp.cliente.id, convId, sede.id);
  }

  private async decidir(
    tx: Tx,
    input: {
      sede: { id: string; zonaHoraria: string };
      tipoEvento: string | null;
      excluirId: string | null;
    },
  ): Promise<DecisionAsignacion> {
    const politica = await this.politicaDe(tx, input.sede.id);
    const miembros = await tx.usuarioSede.findMany({
      where: {
        sedeId: input.sede.id,
        recibeAsignacion: true,
        usuario: { rol: "asesor", activo: true, disponible: true },
      },
      include: {
        usuario: {
          include: {
            especialidades: true,
            horarios: { where: { sedeId: input.sede.id } },
          },
        },
      },
    });
    const ids = miembros.map((m) => m.usuarioId);
    const ahora = new Date();
    const desde = inicioDelDia(input.sede.zonaHoraria, ahora);
    const [abiertas, sinContactar, nuevos] = await Promise.all([
      ids.length
        ? tx.oportunidad.groupBy({
            by: ["asesorAsignadoId"],
            where: {
              asesorAsignadoId: { in: ids },
              etapa: { notIn: [...ETAPAS_CERRADAS] },
            },
            _count: { _all: true },
          })
        : [],
      ids.length
        ? tx.oportunidad.groupBy({
            by: ["asesorAsignadoId"],
            where: {
              asesorAsignadoId: { in: ids },
              etapa: { notIn: [...ETAPAS_CERRADAS] },
              primerContactoHumanoEn: null,
            },
            _count: { _all: true },
          })
        : [],
      ids.length
        ? tx.asignacion.groupBy({
            by: ["usuarioDestinoId"],
            where: { usuarioDestinoId: { in: ids }, creadoEn: { gte: desde } },
            _count: { _all: true },
          })
        : [],
    ]);
    const mapa = (filas: Array<{ asesorAsignadoId: string | null; _count: { _all: number } }>) => {
      const out = new Map<string, number>();
      for (const fila of filas) {
        if (fila.asesorAsignadoId) out.set(fila.asesorAsignadoId, fila._count._all);
      }
      return out;
    };
    const abiertasDe = mapa(abiertas);
    const sinDe = mapa(sinContactar);
    const nuevosDe = new Map<string, number>();
    for (const fila of nuevos) {
      if (fila.usuarioDestinoId) {
        nuevosDe.set(fila.usuarioDestinoId, fila._count._all);
      }
    }

    return elegirAsesor({
      tipoEvento: input.tipoEvento,
      preferirEspecialidad: politica.preferirEspecialidad,
      excluirId: input.excluirId,
      candidatos: miembros.map((m) => ({
        id: m.usuarioId,
        peso: Number(m.peso) || 1,
        sinContactar: sinDe.get(m.usuarioId) ?? 0,
        abiertas: abiertasDe.get(m.usuarioId) ?? 0,
        nuevosHoy: nuevosDe.get(m.usuarioId) ?? 0,
        ultimoAsignadoEn: m.ultimoAsignadoEn,
        topeSinContactar: m.topeSinContactarOverride ?? politica.topeSinContactar,
        topeAbiertas: m.topeAbiertasOverride ?? politica.topeAbiertas,
        topeNuevosDia: politica.topeNuevosDia,
        especialidades: m.usuario.especialidades.map((e) => e.tipoEvento),
        dentroDeHorario: dentroDeHorario(
          m.usuario.horarios,
          ahora,
          input.sede.zonaHoraria,
        ),
      })),
    });
  }

  private async duenoPrevio(
    tx: Tx,
    usuarioId: string | null,
    sedeId: string,
    excluir: string | null,
  ): Promise<string | null> {
    if (!usuarioId || usuarioId === excluir) return null;
    const membresia = await tx.usuarioSede.findUnique({
      where: { usuarioId_sedeId: { usuarioId, sedeId } },
      include: { usuario: { select: { activo: true, rol: true } } },
    });
    if (
      !membresia?.recibeAsignacion ||
      !membresia.usuario.activo ||
      membresia.usuario.rol !== "asesor"
    ) {
      return null;
    }
    return usuarioId;
  }

  private async escribir(
    tx: Tx,
    input: {
      opp: {
        id: string;
        clienteId: string;
        conversaciones: Array<{ id: string; cola: string | null; slaVenceEn: Date | null }>;
      };
      sedeId: string;
      asesorId: string;
      origenId: string | null;
      regla: "manual" | "menor_carga_sede";
      actor: "sistema" | "coordinador" | "admin";
      actorUsuarioId: string | null;
      motivo: string;
      explicacion: Prisma.InputJsonValue;
      slaMinutos: number | null;
    },
  ): Promise<void> {
    const ahora = new Date();
    await tx.asignacion.updateMany({
      where: { oportunidadId: input.opp.id, vigente: true },
      data: { vigente: false },
    });
    await tx.asignacion.create({
      data: {
        clienteId: input.opp.clienteId,
        oportunidadId: input.opp.id,
        usuarioDestinoId: input.asesorId,
        usuarioOrigenId: input.origenId,
        regla: input.regla,
        actor: input.actor,
        actorUsuarioId: input.actorUsuarioId,
        motivo: input.motivo,
        explicacion: input.explicacion,
        vigente: true,
      },
    });
    await tx.cliente.update({
      where: { id: input.opp.clienteId },
      data: { asesorAsignadoId: input.asesorId },
    });
    await tx.oportunidad.update({
      where: { id: input.opp.id },
      data: { asesorAsignadoId: input.asesorId },
    });
    await tx.conversacion.updateMany({
      where: { oportunidadId: input.opp.id },
      data: { asesorLockId: input.asesorId },
    });
    const conv = input.opp.conversaciones[0];
    if (conv && !conv.slaVenceEn && input.slaMinutos != null) {
      await tx.conversacion.update({
        where: { id: conv.id },
        data: { slaVenceEn: new Date(ahora.getTime() + input.slaMinutos * 60_000) },
      });
    }
    await tx.usuarioSede.updateMany({
      where: { usuarioId: input.asesorId, sedeId: input.sedeId },
      data: { ultimoAsignadoEn: ahora },
    });
    await tx.colaAsignacion.updateMany({
      where: { oportunidadId: input.opp.id, estado: "esperando" },
      data: { estado: "asignada", asignadaEn: ahora },
    });
    await tx.eventoOperativo.create({
      data: {
        tipo: "asignacion",
        actor: input.actor,
        clienteId: input.opp.clienteId,
        oportunidadId: input.opp.id,
        conversacionId: conv?.id ?? null,
        sede: input.sedeId,
        payload: {
          asesorId: input.asesorId,
          origenId: input.origenId,
          regla: input.regla,
          motivo: input.motivo,
        },
      },
    });
    await tx.interaccion.create({
      data: {
        clienteId: input.opp.clienteId,
        oportunidadId: input.opp.id,
        conversacionId: conv?.id ?? null,
        tipo: "asignacion",
        actor: input.actor,
        resumen: "Asesor asignado",
        payload: {
          asesorId: input.asesorId,
          origenId: input.origenId,
          regla: input.regla,
          motivo: input.motivo,
        },
      },
    });
  }

  private async soltarDueno(tx: Tx, oportunidadId: string, clienteId: string): Promise<void> {
    await tx.asignacion.updateMany({
      where: { oportunidadId, vigente: true },
      data: { vigente: false },
    });
    await tx.cliente.update({
      where: { id: clienteId },
      data: { asesorAsignadoId: null },
    });
    await tx.oportunidad.update({
      where: { id: oportunidadId },
      data: { asesorAsignadoId: null },
    });
    await tx.conversacion.updateMany({
      where: { oportunidadId },
      data: { asesorLockId: null },
    });
  }

  private async encolar(
    tx: Tx,
    input: {
      oportunidadId: string;
      sedeId: string;
      disparador: DisparadorAsignar;
      motivo: "sin_disponibles" | "todos_en_tope" | "en_exploracion" | "dueno_inactivo";
      detalle: Prisma.InputJsonValue | null;
    },
  ): Promise<boolean> {
    const existente = await tx.colaAsignacion.findFirst({
      where: { oportunidadId: input.oportunidadId, estado: "esperando" },
      select: { id: true, motivo: true },
    });
    if (existente) {
      if (existente.motivo === input.motivo) return false;
      await tx.colaAsignacion.update({
        where: { id: existente.id },
        data: {
          motivo: input.motivo,
          disparador: input.disparador,
          detalle: input.detalle ?? undefined,
          intentos: { increment: 1 },
        },
      });
      return false;
    }
    try {
      await tx.colaAsignacion.create({
        data: {
          oportunidadId: input.oportunidadId,
          sedeId: input.sedeId,
          disparador: input.disparador,
          motivo: input.motivo,
          detalle: input.detalle ?? undefined,
          estado: "esperando",
        },
      });
      return true;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") return false;
      throw err;
    }
  }

  private async resolverSede(
    tx: Tx,
    sedeId: string | null,
  ): Promise<{ id: string; zonaHoraria: string } | null> {
    const preferida = sedeId || SEDE_ID;
    const sede = await tx.sede.findUnique({
      where: { id: preferida },
      select: { id: true, zonaHoraria: true },
    });
    if (sede) return sede;
    if (preferida === SEDE_ID) return null;
    return tx.sede.findUnique({
      where: { id: SEDE_ID },
      select: { id: true, zonaHoraria: true },
    });
  }

  private async politicaDe(tx: Tx, sedeId: string) {
    const existente = await tx.politicaAsignacion.findUnique({ where: { sedeId } });
    if (existente) return existente;
    try {
      return await tx.politicaAsignacion.create({ data: { sedeId } });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "P2002") throw err;
      const otra = await tx.politicaAsignacion.findUnique({ where: { sedeId } });
      if (!otra) throw err;
      return otra;
    }
  }

  private async minutosSla(tx: Tx, sedeId: string, cola: string | null): Promise<number> {
    if (cola === "comercial") return 15;
    const politica = await this.politicaDe(tx, sedeId);
    return politica.slaMinutos;
  }

  private async avisar(result: AsignarResult): Promise<void> {
    if (result.estado === "asignado" && result.asesorId) {
      this.notifications?.notifyAsignacion({
        conversacionId: result.conversacionId ?? "",
        asesorId: result.asesorId,
        motivo: "asignacion",
      });
      if (result.conversacionId) {
        await this.alertas?.avisarAsignacion({
          conversacionId: result.conversacionId,
          asesorId: result.asesorId,
          clienteId: result.clienteId,
        });
      }
      return;
    }
    if (
      result.estado === "en_cola" &&
      result.creadaCola &&
      result.motivoCola &&
      result.motivoCola !== "en_exploracion" &&
      result.conversacionId &&
      result.sedeId
    ) {
      await this.alertas?.avisarCola({
        conversacionId: result.conversacionId,
        sedeId: result.sedeId,
        motivo: result.motivoCola,
        clienteId: result.clienteId,
      });
    }
  }

  private puedeEscribir(): boolean {
    return Boolean(this.prisma && process.env.DATABASE_URL);
  }

  private fallo(contexto: string, err: unknown): void {
    this.logger.warn(
      `${contexto}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function comoJson(valor: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}

function omitido(
  clienteId: string | null = null,
  sedeId: string | null = null,
  conversacionId: string | null = null,
): AsignarResult {
  return {
    estado: "omitido",
    asesorId: null,
    motivoCola: null,
    sedeId,
    conversacionId,
    clienteId,
    creadaCola: false,
  };
}

function conservado(
  asesorId: string,
  clienteId: string,
  conversacionId: string | null,
  sedeId: string | null,
): AsignarResult {
  return {
    estado: "conservado",
    asesorId,
    motivoCola: null,
    sedeId,
    conversacionId,
    clienteId,
    creadaCola: false,
  };
}

function asignado(
  asesorId: string,
  clienteId: string,
  conversacionId: string | null,
  sedeId: string,
): AsignarResult {
  return {
    estado: "asignado",
    asesorId,
    motivoCola: null,
    sedeId,
    conversacionId,
    clienteId,
    creadaCola: false,
  };
}
