import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import {
  identifiersFromThread,
  mapCanalCrm,
} from "../../crm/cliente-identity";
import type {
  CamposCapturados,
  ColaAsesor,
  ConversacionState,
  EstadoBot,
  GuionVersion,
  MotivoHandoff,
  PasoGuion,
  RutaComercial,
  RutaOrquestador,
} from "../types";
import {
  SESSION_GAP_MS,
  buildResumen,
  canonicalCamposJson,
  debeReanudar,
  mergeCampos,
  ultimasLineas,
  type LineaMemoria,
} from "./cliente-memoria.logic";

export interface SeguimientoMemoria {
  tipo: "nutricion_t24" | "nutricion_t7";
  disparaEn: string;
  conversacionId: string;
  nombre: string | null;
  cancelado: boolean;
  disparadoEn: string | null;
  oportunidadId: string | null;
}

interface PerfilMemoria {
  key: string;
  clienteId: string | null;
  alias: string[];
  campos: CamposCapturados;
  pasoGuion: PasoGuion;
  guionVersion: GuionVersion | null;
  rutaComercial: RutaComercial | null;
  estadoBot: EstadoBot;
  resumen: string;
  ultimoTurnoEn: string | null;
  oportunidadAbiertaId: string | null;
  asesorLockId: string | null;
  slaVenceEn: string | null;
  cola: ColaAsesor | null;
  motivoHandoff: MotivoHandoff | null;
  escaladoEn: string | null;
  ultimaRuta: RutaOrquestador | null;
  paqueteTentativoId: string | null;
  pedidoCotizacion: boolean | null;
  pedidoCotizacionFuente: string | null;
  notasHandoff: string[];
  recientes: LineaMemoria[];
  seguimientos: SeguimientoMemoria[];
}

type MemoriaRow = {
  clienteId: string;
  campos: unknown;
  pasoGuion: string;
  guionVersion: string | null;
  rutaComercial: string | null;
  estadoBot: string;
  resumen: string;
  ultimoTurnoEn: Date | null;
  oportunidadAbiertaId: string | null;
  asesorLockId: string | null;
  slaVenceEn: Date | null;
  cola: string | null;
  motivoHandoff: string | null;
  escaladoEn: Date | null;
  ultimaRuta: string | null;
  paqueteTentativoId: string | null;
  pedidoCotizacion: boolean | null;
  pedidoCotizacionFuente: string | null;
};

/**
 * Expediente de memoria por cliente.
 * En proceso es la caché; con Postgres es la fuente de verdad y serializa
 * los turnos del mismo cliente con un lock de transacción.
 */
@Injectable()
export class ClienteMemoriaService {
  private readonly logger = new Logger(ClienteMemoriaService.name);
  private readonly perfiles = new Map<string, PerfilMemoria>();
  private readonly alias = new Map<string, string>();
  private readonly tails = new Map<string, Promise<void>>();

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  sessionGapMs(): number {
    const raw =
      this.config?.get<string>("MEMORIA_SESION_HORAS") ??
      process.env.MEMORIA_SESION_HORAS;
    const hours = Number(raw);
    if (Number.isFinite(hours) && hours > 0) return hours * 60 * 60 * 1000;
    return SESSION_GAP_MS;
  }

  async aplicar(
    state: ConversacionState,
    input: { perfilWaId?: string | null; now?: Date } = {},
  ): Promise<ConversacionState> {
    const keys = this.keysFor(state, input.perfilWaId);
    const ahora = input.now ?? new Date();
    return this.exclusive(lockKey(keys, state.id), async () => {
      let perfil = this.findPerfil(keys);
      const desdeDb = await this.loadFromDb(keys, state);
      if (desdeDb) perfil = this.adopt(perfil, desdeDb, keys);
      if (!perfil) {
        perfil = this.seed(keys, state);
      } else {
        this.overlay(state, perfil, ahora);
      }
      this.index(perfil, keys);
      return state;
    });
  }

  commitFromState(state: ConversacionState, now = new Date()): PerfilMemoria {
    const keys = this.keysFor(state, null);
    let perfil = this.findPerfil(keys) ?? this.seed(keys, state);
    const replace = process.env.FIELD_TEST_RESET === "1";
    perfil.campos = replace
      ? { ...state.camposCapturados }
      : mergeCampos(perfil.campos, state.camposCapturados);
    state.camposCapturados = { ...perfil.campos };
    perfil.pasoGuion = state.pasoGuion;
    perfil.guionVersion = state.guionVersion ?? perfil.guionVersion;
    perfil.rutaComercial = state.camposCapturados.rutaComercial ?? perfil.rutaComercial;
    perfil.estadoBot = state.estadoBot;
    perfil.asesorLockId = state.asesorLockId ?? null;
    perfil.slaVenceEn = state.slaVenceEn ?? null;
    perfil.cola = state.cola ?? null;
    perfil.motivoHandoff = state.motivoHandoff;
    perfil.escaladoEn = state.escaladoEn;
    perfil.ultimaRuta = state.ultimaRuta;
    perfil.paqueteTentativoId = state.paqueteTentativoId;
    perfil.pedidoCotizacion = state.pedidoCotizacion ?? perfil.pedidoCotizacion;
    perfil.pedidoCotizacionFuente =
      state.pedidoCotizacionFuente ?? perfil.pedidoCotizacionFuente;
    if (!perfil.oportunidadAbiertaId) {
      perfil.oportunidadAbiertaId = state.oportunidadId;
    } else {
      state.oportunidadId = perfil.oportunidadAbiertaId;
    }
    perfil.recientes = ultimasLineas(state);
    perfil.ultimoTurnoEn = now.toISOString();
    perfil.resumen = buildResumen({
      campos: perfil.campos,
      pasoGuion: perfil.pasoGuion,
      ultimaRuta: perfil.ultimaRuta,
      notasHandoff: perfil.notasHandoff,
    });
    state.resumenMemoria = perfil.resumen;
    state.ventanaContexto = perfil.recientes;
    this.index(perfil, keys);
    return perfil;
  }

  async flush(clienteId: string, state: ConversacionState): Promise<void> {
    const perfil = this.commitFromState(state);
    perfil.clienteId = clienteId;
    this.index(perfil, [`cliente:${clienteId}`]);
    await this.persistProfile(perfil);
  }

  async recordHumanInbound(input: {
    canal: string;
    externalThreadId: string;
    texto: string;
    telefono?: string | null;
  }): Promise<void> {
    const draft = {
      canal: input.canal,
      externalThreadId: input.externalThreadId,
      camposCapturados: { telefono: input.telefono ?? null },
    } as ConversacionState;
    const keys = this.keysFor(draft, null);
    await this.exclusive(lockKey(keys, input.externalThreadId), async () => {
      const perfil = this.findPerfil(keys) ?? this.seed(keys, draft);
      const nota = input.texto.trim();
      if (nota) {
        perfil.notasHandoff.push(nota);
        perfil.notasHandoff = perfil.notasHandoff.slice(-8);
        perfil.recientes.push({ autor: "prospecto", contenido: nota });
        perfil.recientes = perfil.recientes.slice(-8);
      }
      perfil.estadoBot = "humano";
      perfil.resumen = buildResumen({
        campos: perfil.campos,
        pasoGuion: perfil.pasoGuion,
        ultimaRuta: perfil.ultimaRuta,
        notasHandoff: perfil.notasHandoff,
      });
      this.index(perfil, keys);
      await this.persistProfile(perfil);
      await this.insertHumanMessage(perfil, input);
    });
  }

  async buscarEstado(
    canal: string,
    externalThreadId: string,
  ): Promise<{ estadoBot: EstadoBot; oportunidadId: string | null; cola: ColaAsesor | null } | null> {
    const keys = this.keysFor(
      {
        canal,
        externalThreadId,
        camposCapturados: {},
      } as ConversacionState,
      null,
    );
    const perfil = this.findPerfil(keys) ?? (await this.loadFromDb(keys, {
      canal,
      externalThreadId,
      camposCapturados: {},
    } as ConversacionState));
    if (!perfil) return null;
    return {
      estadoBot: perfil.estadoBot,
      oportunidadId: perfil.oportunidadAbiertaId,
      cola: perfil.cola,
    };
  }

  syncEstado(
    clienteId: string,
    patch: {
      estadoBot: EstadoBot;
      asesorLockId?: string | null;
      slaVenceEn?: string | null;
    },
  ): void {
    const perfil = this.findPerfil([`cliente:${clienteId}`]);
    if (!perfil) return;
    perfil.estadoBot = patch.estadoBot;
    if ("asesorLockId" in patch) perfil.asesorLockId = patch.asesorLockId ?? null;
    if ("slaVenceEn" in patch) perfil.slaVenceEn = patch.slaVenceEn ?? null;
  }

  programarNutricion(input: {
    conversacionId: string;
    nombre?: string | null;
    oportunidadId?: string | null;
    clienteId?: string | null;
    now?: Date;
  }): SeguimientoMemoria[] {
    const now = input.now ?? new Date();
    const jobs: SeguimientoMemoria[] = [
      {
        tipo: "nutricion_t24",
        disparaEn: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        conversacionId: input.conversacionId,
        nombre: input.nombre ?? null,
        cancelado: false,
        disparadoEn: null,
        oportunidadId: input.oportunidadId ?? null,
      },
      {
        tipo: "nutricion_t7",
        disparaEn: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        conversacionId: input.conversacionId,
        nombre: input.nombre ?? null,
        cancelado: false,
        disparadoEn: null,
        oportunidadId: input.oportunidadId ?? null,
      },
    ];
    const keys = [`thread:${input.conversacionId}`];
    if (input.clienteId) keys.push(`cliente:${input.clienteId}`);
    const perfil =
      this.findPerfil(keys) ??
      this.seed(keys, {
        id: input.conversacionId,
        canal: "whatsapp",
        externalThreadId: input.conversacionId,
        pasoGuion: "faq_libre",
        camposCapturados: { nombre: input.nombre ?? null },
        estadoBot: "activo",
        oportunidadId: input.oportunidadId ?? input.conversacionId,
      } as ConversacionState);
    perfil.seguimientos = jobs;
    if (input.clienteId) perfil.clienteId = input.clienteId;
    this.index(perfil, keys);
    void this.persistSeguimientos(perfil, jobs);
    return jobs;
  }

  cancelarNutricion(conversacionId: string): void {
    for (const perfil of this.perfiles.values()) {
      let changed = false;
      for (const job of perfil.seguimientos) {
        if (job.conversacionId === conversacionId && !job.cancelado) {
          job.cancelado = true;
          changed = true;
        }
      }
      if (changed) void this.persistSeguimientos(perfil, perfil.seguimientos);
    }
  }

  seguimientosDe(conversacionId: string): SeguimientoMemoria[] {
    const found: SeguimientoMemoria[] = [];
    for (const perfil of this.perfiles.values()) {
      for (const job of perfil.seguimientos) {
        if (job.conversacionId === conversacionId && !job.cancelado) found.push(job);
      }
    }
    return found;
  }

  listarSeguimientosActivos(): SeguimientoMemoria[] {
    const found: SeguimientoMemoria[] = [];
    for (const perfil of this.perfiles.values()) {
      for (const job of perfil.seguimientos) {
        if (!job.cancelado && !job.disparadoEn) found.push(job);
      }
    }
    return found;
  }

  marcarDisparado(
    conversacionId: string,
    tipo: SeguimientoMemoria["tipo"],
  ): void {
    const ahora = new Date().toISOString();
    for (const perfil of this.perfiles.values()) {
      for (const job of perfil.seguimientos) {
        if (job.conversacionId === conversacionId && job.tipo === tipo) {
          job.disparadoEn = ahora;
          job.cancelado = true;
        }
      }
    }
  }

  async hidratarSeguimientos(): Promise<SeguimientoMemoria[]> {
    const db = this.seguimientoDelegate();
    if (!db?.findMany || !this.canWrite()) return [];
    try {
      const rows = (await db.findMany({
        where: { cancelado: false, disparadoEn: null },
      })) as Array<{
        tipo: "nutricion_t24" | "nutricion_t7";
        disparaEn: Date;
        conversacionId: string | null;
        nombre: string | null;
        oportunidadId: string | null;
        clienteId: string;
      }>;
      const jobs: SeguimientoMemoria[] = [];
      for (const row of rows) {
        const job: SeguimientoMemoria = {
          tipo: row.tipo,
          disparaEn: row.disparaEn.toISOString(),
          conversacionId: row.conversacionId ?? row.clienteId,
          nombre: row.nombre,
          cancelado: false,
          disparadoEn: null,
          oportunidadId: row.oportunidadId,
        };
        jobs.push(job);
        const perfil =
          this.findPerfil([`cliente:${row.clienteId}`]) ??
          this.seed([`cliente:${row.clienteId}`], {
            id: job.conversacionId,
            canal: "whatsapp",
            externalThreadId: job.conversacionId,
            pasoGuion: "faq_libre",
            camposCapturados: {},
            estadoBot: "activo",
            oportunidadId: job.oportunidadId ?? job.conversacionId,
          } as ConversacionState);
        perfil.clienteId = row.clienteId;
        const exists = perfil.seguimientos.some(
          (j) => j.tipo === job.tipo && j.conversacionId === job.conversacionId,
        );
        if (!exists) perfil.seguimientos.push(job);
        this.index(perfil, [`cliente:${row.clienteId}`]);
      }
      return jobs;
    } catch (err) {
      this.logger.warn(
        `No se pudieron hidratar seguimientos: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  /** Perfil en caché, para pruebas de reinicio del store. */
  perfilDe(state: Pick<ConversacionState, "canal" | "externalThreadId" | "camposCapturados">): PerfilMemoria | null {
    return this.findPerfil(this.keysFor(state as ConversacionState, null));
  }

  private overlay(state: ConversacionState, perfil: PerfilMemoria, ahora: Date): void {
    state.camposCapturados = mergeCampos(perfil.campos, state.camposCapturados);
    state.pasoGuion = perfil.pasoGuion || state.pasoGuion;
    state.estadoBot = perfil.estadoBot;
    state.guionVersion = perfil.guionVersion ?? state.guionVersion;
    if (perfil.oportunidadAbiertaId) state.oportunidadId = perfil.oportunidadAbiertaId;
    if (perfil.asesorLockId) state.asesorLockId = perfil.asesorLockId;
    if (perfil.slaVenceEn) state.slaVenceEn = perfil.slaVenceEn;
    if (perfil.cola) state.cola = perfil.cola;
    if (perfil.motivoHandoff) state.motivoHandoff = perfil.motivoHandoff;
    if (perfil.escaladoEn) state.escaladoEn = perfil.escaladoEn;
    if (perfil.ultimaRuta) state.ultimaRuta = perfil.ultimaRuta;
    if (perfil.paqueteTentativoId) state.paqueteTentativoId = perfil.paqueteTentativoId;
    state.pedidoCotizacion = perfil.pedidoCotizacion;
    state.pedidoCotizacionFuente = perfil.pedidoCotizacionFuente;
    state.resumenMemoria = perfil.resumen;
    state.ventanaContexto = perfil.recientes;
    state.reanudarSesion = debeReanudar({
      ultimoTurnoEn: perfil.ultimoTurnoEn,
      ahora,
      gapMs: this.sessionGapMs(),
    });
    if (perfil.campos.rutaComercial && !state.camposCapturados.rutaComercial) {
      state.camposCapturados.rutaComercial = perfil.rutaComercial;
    }
  }

  private seed(keys: string[], state: ConversacionState): PerfilMemoria {
    const perfil: PerfilMemoria = {
      key: keys[0] ?? state.externalThreadId,
      clienteId: null,
      alias: [],
      campos: { ...state.camposCapturados },
      pasoGuion: state.pasoGuion,
      guionVersion: state.guionVersion ?? null,
      rutaComercial: state.camposCapturados.rutaComercial ?? null,
      estadoBot: state.estadoBot ?? "activo",
      resumen: "",
      ultimoTurnoEn: null,
      oportunidadAbiertaId: state.oportunidadId ?? null,
      asesorLockId: state.asesorLockId ?? null,
      slaVenceEn: state.slaVenceEn ?? null,
      cola: state.cola ?? null,
      motivoHandoff: state.motivoHandoff ?? null,
      escaladoEn: state.escaladoEn ?? null,
      ultimaRuta: state.ultimaRuta ?? null,
      paqueteTentativoId: state.paqueteTentativoId ?? null,
      pedidoCotizacion: state.pedidoCotizacion ?? null,
      pedidoCotizacionFuente: state.pedidoCotizacionFuente ?? null,
      notasHandoff: [],
      recientes: ultimasLineas(state),
      seguimientos: [],
    };
    perfil.resumen = buildResumen({
      campos: perfil.campos,
      pasoGuion: perfil.pasoGuion,
      ultimaRuta: perfil.ultimaRuta,
    });
    this.index(perfil, keys);
    return perfil;
  }

  private adopt(
    local: PerfilMemoria | null,
    remoto: PerfilMemoria,
    keys: string[],
  ): PerfilMemoria {
    if (!local) {
      this.index(remoto, keys);
      return remoto;
    }
    local.campos = mergeCampos(remoto.campos, local.campos);
    local.clienteId = remoto.clienteId ?? local.clienteId;
    local.pasoGuion = remoto.pasoGuion;
    local.estadoBot = remoto.estadoBot;
    local.resumen = remoto.resumen || local.resumen;
    local.ultimoTurnoEn = remoto.ultimoTurnoEn ?? local.ultimoTurnoEn;
    local.oportunidadAbiertaId =
      remoto.oportunidadAbiertaId ?? local.oportunidadAbiertaId;
    local.guionVersion = (remoto.guionVersion as GuionVersion | null) ?? local.guionVersion;
    local.pedidoCotizacion = remoto.pedidoCotizacion;
    local.pedidoCotizacionFuente = remoto.pedidoCotizacionFuente;
    if (remoto.recientes.length) local.recientes = remoto.recientes;
    this.index(local, keys);
    return local;
  }

  private keysFor(
    state: Pick<ConversacionState, "canal" | "externalThreadId" | "camposCapturados">,
    perfilWaId?: string | null,
  ): string[] {
    const ids = identifiersFromThread({
      canal: state.canal,
      externalThreadId: state.externalThreadId,
      perfil: { waId: perfilWaId },
      campos: state.camposCapturados,
    });
    const keys = ids.map((id) => `${id.tipo}:${id.valorNormalizado}`);
    keys.push(`${mapCanalCrm(state.canal)}::${state.externalThreadId}`);
    return keys;
  }

  private findPerfil(keys: string[]): PerfilMemoria | null {
    for (const key of keys) {
      const id = this.alias.get(key);
      if (!id) continue;
      const perfil = this.perfiles.get(id);
      if (perfil) return perfil;
    }
    return null;
  }

  private index(perfil: PerfilMemoria, keys: string[]): void {
    this.perfiles.set(perfil.key, perfil);
    for (const key of keys) {
      perfil.alias.push(key);
      this.alias.set(key, perfil.key);
    }
    if (perfil.clienteId) this.alias.set(`cliente:${perfil.clienteId}`, perfil.key);
  }

  private async loadFromDb(
    keys: string[],
    state: ConversacionState,
  ): Promise<PerfilMemoria | null> {
    if (!this.canWrite()) return null;
    const prisma = this.prisma as unknown as {
      identificadorCliente?: {
        findMany: (args: unknown) => Promise<Array<{ clienteId: string }>>;
      };
      mensaje?: {
        findMany: (args: unknown) => Promise<Array<{ autor: LineaMemoria["autor"]; contenido: string }>>;
      };
    };
    const delegate = this.memoriaDelegate();
    if (!delegate?.findUnique || !prisma.identificadorCliente?.findMany) return null;
    try {
      const ids = identifiersFromThread({
        canal: state.canal,
        externalThreadId: state.externalThreadId,
        campos: state.camposCapturados,
      });
      if (!ids.length) return null;
      const matches = await prisma.identificadorCliente.findMany({
        where: {
          OR: ids.map((id) => ({
            tipo: id.tipo,
            valorNormalizado: id.valorNormalizado,
          })),
        },
        select: { clienteId: true },
      });
      const clienteId = matches[0]?.clienteId;
      if (!clienteId) return null;
      const row = (await delegate.findUnique({
        where: { clienteId },
      })) as MemoriaRow | null;
      if (!row) return null;
      const recientes = prisma.mensaje?.findMany && row.oportunidadAbiertaId
        ? await prisma.mensaje.findMany({
            where: { conversacion: { oportunidadId: row.oportunidadAbiertaId } },
            orderBy: { creadoEn: "desc" },
            take: 8,
            select: { autor: true, contenido: true },
          })
        : [];
      const perfil = this.seed([`cliente:${clienteId}`, ...keys], {
        ...state,
        pasoGuion: row.pasoGuion as PasoGuion,
        camposCapturados: camposFrom(row.campos),
        estadoBot: row.estadoBot as EstadoBot,
        oportunidadId: row.oportunidadAbiertaId ?? state.oportunidadId,
        guionVersion: (row.guionVersion as GuionVersion | null) ?? state.guionVersion,
      });
      perfil.clienteId = clienteId;
      perfil.resumen = row.resumen ?? "";
      perfil.ultimoTurnoEn = row.ultimoTurnoEn?.toISOString() ?? null;
      perfil.asesorLockId = row.asesorLockId;
      perfil.slaVenceEn = row.slaVenceEn?.toISOString() ?? null;
      perfil.cola = (row.cola as ColaAsesor | null) ?? null;
      perfil.motivoHandoff = (row.motivoHandoff as MotivoHandoff | null) ?? null;
      perfil.escaladoEn = row.escaladoEn?.toISOString() ?? null;
      perfil.ultimaRuta = (row.ultimaRuta as RutaOrquestador | null) ?? null;
      perfil.paqueteTentativoId = row.paqueteTentativoId;
      perfil.pedidoCotizacion = row.pedidoCotizacion;
      perfil.pedidoCotizacionFuente = row.pedidoCotizacionFuente;
      perfil.rutaComercial = (row.rutaComercial as RutaComercial | null) ?? null;
      perfil.recientes = [...recientes].reverse();
      this.index(perfil, keys);
      return perfil;
    } catch (err) {
      this.logger.warn(
        `No se pudo leer memoria de cliente: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async persistProfile(perfil: PerfilMemoria): Promise<void> {
    const delegate = this.memoriaDelegate();
    if (!delegate?.upsert || !perfil.clienteId || !this.canWrite()) return;
    const data = {
      campos: canonicalCamposJson(perfil.campos),
      pasoGuion: perfil.pasoGuion,
      guionVersion: perfil.guionVersion,
      rutaComercial: perfil.rutaComercial,
      estadoBot: perfil.estadoBot,
      resumen: perfil.resumen,
      resumenActualizadoEn: new Date(),
      ultimoTurnoEn: perfil.ultimoTurnoEn ? new Date(perfil.ultimoTurnoEn) : new Date(),
      oportunidadAbiertaId: perfil.oportunidadAbiertaId,
      asesorLockId: perfil.asesorLockId,
      slaVenceEn: perfil.slaVenceEn ? new Date(perfil.slaVenceEn) : null,
      cola: perfil.cola,
      motivoHandoff: perfil.motivoHandoff,
      escaladoEn: perfil.escaladoEn ? new Date(perfil.escaladoEn) : null,
      ultimaRuta: perfil.ultimaRuta,
      paqueteTentativoId: perfil.paqueteTentativoId,
      pedidoCotizacion: perfil.pedidoCotizacion,
      pedidoCotizacionFuente: perfil.pedidoCotizacionFuente,
    };
    try {
      const run = async (tx: { memoriaCliente: { upsert: (args: unknown) => Promise<unknown> }; $executeRaw?: Function }) => {
        if (tx.$executeRaw) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${perfil.clienteId}))`;
        }
        await tx.memoriaCliente.upsert({
          where: { clienteId: perfil.clienteId },
          create: { clienteId: perfil.clienteId, ...data },
          update: data,
        });
      };
      const prisma = this.prisma as unknown as {
        $transaction?: (fn: (tx: unknown) => Promise<void>) => Promise<void>;
        $executeRaw?: Function;
        memoriaCliente: { upsert: (args: unknown) => Promise<unknown> };
      };
      if (prisma.$transaction) {
        await prisma.$transaction(async (tx) => {
          const scoped = tx as {
            memoriaCliente?: { upsert: (args: unknown) => Promise<unknown> };
            $executeRaw?: Function;
          };
          await run({
            memoriaCliente: scoped.memoriaCliente ?? prisma.memoriaCliente,
            $executeRaw: scoped.$executeRaw,
          });
        });
      } else {
        await delegate.upsert({
          where: { clienteId: perfil.clienteId },
          create: { clienteId: perfil.clienteId, ...data },
          update: data,
        });
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo guardar memoria ${perfil.clienteId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async persistSeguimientos(
    perfil: PerfilMemoria,
    jobs: SeguimientoMemoria[],
  ): Promise<void> {
    const db = this.seguimientoDelegate();
    if (!db?.create || !perfil.clienteId || !this.canWrite()) return;
    try {
      if (db.deleteMany) {
        await db.deleteMany({
          where: {
            clienteId: perfil.clienteId,
            disparadoEn: null,
          },
        });
      }
      for (const job of jobs) {
        await db.create({
          data: {
            clienteId: perfil.clienteId,
            oportunidadId: job.oportunidadId,
            conversacionId: job.conversacionId,
            tipo: job.tipo,
            disparaEn: new Date(job.disparaEn),
            nombre: job.nombre,
            cancelado: job.cancelado,
          },
        });
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo guardar seguimiento: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async insertHumanMessage(
    perfil: PerfilMemoria,
    input: { canal: string; externalThreadId: string; texto: string },
  ): Promise<void> {
    if (!this.canWrite() || !perfil.clienteId) return;
    const prisma = this.prisma as unknown as {
      conversacion?: {
        findUnique: (args: unknown) => Promise<{ id: string; canal: string } | null>;
      };
      mensaje?: { create: (args: unknown) => Promise<unknown> };
    };
    if (!prisma.conversacion?.findUnique || !prisma.mensaje?.create) return;
    try {
      const conv = await prisma.conversacion.findUnique({
        where: {
          canal_externalThreadId: {
            canal: mapCanalCrm(input.canal),
            externalThreadId: input.externalThreadId,
          },
        },
        select: { id: true, canal: true },
      });
      if (!conv) return;
      await prisma.mensaje.create({
        data: {
          conversacionId: conv.id,
          direccion: "entrante",
          autor: "prospecto",
          canal: conv.canal,
          contenido: input.texto,
        },
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo guardar mensaje en handoff: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private memoriaDelegate(): {
    findUnique?: (args: unknown) => Promise<unknown>;
    upsert?: (args: unknown) => Promise<unknown>;
  } | null {
    const prisma = this.prisma as unknown as {
      memoriaCliente?: {
        findUnique?: (args: unknown) => Promise<unknown>;
        upsert?: (args: unknown) => Promise<unknown>;
      };
    } | undefined;
    return prisma?.memoriaCliente ?? null;
  }

  private seguimientoDelegate(): {
    findMany?: (args: unknown) => Promise<unknown>;
    create?: (args: unknown) => Promise<unknown>;
    deleteMany?: (args: unknown) => Promise<unknown>;
  } | null {
    const prisma = this.prisma as unknown as {
      seguimientoProgramado?: {
        findMany?: (args: unknown) => Promise<unknown>;
        create?: (args: unknown) => Promise<unknown>;
        deleteMany?: (args: unknown) => Promise<unknown>;
      };
    } | undefined;
    return prisma?.seguimientoProgramado ?? null;
  }

  private canWrite(): boolean {
    return Boolean(this.prisma && process.env.DATABASE_URL);
  }

  private async exclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(
      key,
      prev.then(() => gate),
    );
    await prev.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

function lockKey(keys: string[], fallback: string): string {
  return (
    keys.find((key) => key.startsWith("telefono:")) ??
    keys.find((key) => key.startsWith("wa_id:")) ??
    keys[0] ??
    fallback
  );
}

function camposFrom(json: unknown): CamposCapturados {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  return { ...(json as CamposCapturados) };
}
