import { Injectable } from "@nestjs/common";
import { TipoEvento } from "@prisma/client";
import {
  AFORO_TRAMOS_BODA,
  canonicalizeSku,
  sedeToCatalogSlug,
} from "@tres-cielos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PISO_INVERSION_MXN } from "../conversation/conversation-flow";
import {
  fechaConsultaDate,
  matchPrecioPorAforo,
  pickSkuBajoPiso,
  pickSkuPisoVigente,
  vigenciaWhere,
} from "./catalog-price.util";
import {
  normalizeTipoEventoArg,
  pickCercanos,
  type DiagnosticoBusquedaVacia,
  type PaqueteCatalogoVista,
  type PrecioMuestra,
} from "./catalog-search.util";

const TIPOS_EVENTO: TipoEvento[] = [
  "boda",
  "xv",
  "corporativo",
  "social",
  "otro",
  "multi",
];

function coerceTipoEvento(tipo: string | undefined): TipoEvento | null {
  const t = normalizeTipoEventoArg(tipo);
  if (!t) return null;
  return TIPOS_EVENTO.includes(t as TipoEvento) ? (t as TipoEvento) : null;
}

type PrecioDb = {
  monto: number | null;
  moneda: string;
  unidad: string;
  rangoMin: number | null;
  rangoMax: number | null;
};

function toVista(
  p: {
    id: string;
    codigoSku: string;
    nombre: string;
    tipoEvento: TipoEvento;
    sede: string | null;
    aforoMin: number;
    aforoMax: number;
    descripcionCorta: string | null;
    precios: PrecioDb[];
  },
  aforo?: number,
): PaqueteCatalogoVista {
  const match = matchPrecioPorAforo(p.precios, aforo);
  let precioMuestra: PrecioMuestra | null = null;
  let precioTramo: PaqueteCatalogoVista["precioTramo"];
  let tramosPublicados: number[] | undefined;
  if (match.kind === "exact" || match.kind === "desde") {
    precioTramo = match.kind;
    precioMuestra = {
      monto: Number(match.row.monto),
      moneda: match.row.moneda,
      unidad: match.row.unidad,
      aforoTramo: match.aforoTramo,
      totalEvento: match.totalEvento,
      desde: match.kind === "desde",
    };
  } else if (match.kind === "sin_interpolar") {
    precioTramo = "sin_interpolar";
    tramosPublicados = match.tramosPublicados;
  } else {
    precioTramo = "sin_vigente";
  }
  return {
    id: p.id,
    sku: p.codigoSku,
    nombre: p.nombre,
    tipoEvento: p.tipoEvento,
    sede: p.sede ?? undefined,
    aforoMin: p.aforoMin,
    aforoMax: p.aforoMax,
    descripcionCorta: p.descripcionCorta,
    precioMuestra,
    precioTramo,
    tramosPublicados,
  };
}

@Injectable()
export class CatalogToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPaquetes(input: {
    tipoEvento: string;
    aforo?: number;
    sede?: string;
    fecha?: string;
  }) {
    const tipo = coerceTipoEvento(input.tipoEvento);
    if (!tipo) return [];
    const sede = sedeToCatalogSlug(input.sede) ?? input.sede;
    const fechaConsulta = fechaConsultaDate(input.fecha);
    const all = await this.prisma.paquete.findMany({
      where: {
        estado: "publicado",
        tipoEvento: tipo,
        ...(sede ? { sede } : {}),
      },
      include: {
        precios: {
          where: vigenciaWhere(fechaConsulta),
          orderBy: { rangoMin: "asc" },
        },
      },
      orderBy: { codigoSku: "asc" },
    });

    const filtered = all.filter((p) => {
      if (input.aforo == null) return true;
      return input.aforo >= p.aforoMin && input.aforo <= p.aforoMax;
    });

    return filtered.map((p) => toVista(p, input.aforo));
  }

  async diagnosticoBusquedaVacia(input: {
    tipoEvento: string;
    aforo?: number;
    sede?: string;
    fecha?: string;
  }): Promise<DiagnosticoBusquedaVacia> {
    const tipo = coerceTipoEvento(input.tipoEvento);
    const sede = sedeToCatalogSlug(input.sede) ?? input.sede;
    const fechaConsulta = fechaConsultaDate(input.fecha);
    const publicados = await this.prisma.paquete.findMany({
      where: { estado: "publicado" },
      include: {
        precios: {
          where: vigenciaWhere(fechaConsulta),
          orderBy: { rangoMin: "asc" },
        },
      },
      orderBy: { codigoSku: "asc" },
    });

    if (publicados.length === 0) {
      return {
        motivo: "sin_publicados",
        aforoLead: input.aforo,
        tipoEvento: tipo ?? input.tipoEvento,
        cercanos: [],
      };
    }

    const delTipo = tipo
      ? publicados.filter((p) => p.tipoEvento === tipo)
      : [];
    if (delTipo.length === 0) {
      return {
        motivo: "tipo",
        aforoLead: input.aforo,
        tipoEvento: tipo ?? input.tipoEvento,
        cercanos: [],
      };
    }

    const conSede = sede
      ? delTipo.filter((p) => p.sede === sede)
      : delTipo;
    if (sede && conSede.length === 0) {
      return {
        motivo: "sede",
        aforoLead: input.aforo,
        tipoEvento: tipo ?? input.tipoEvento,
        cercanos: [],
      };
    }

    const pool = conSede.length > 0 ? conSede : delTipo;
    return {
      motivo: input.aforo != null ? "aforo" : "tipo",
      aforoLead: input.aforo,
      aforoMinCatalogo: Math.min(...pool.map((p) => p.aforoMin)),
      aforoMaxCatalogo: Math.max(...pool.map((p) => p.aforoMax)),
      tipoEvento: tipo ?? input.tipoEvento,
      cercanos: pickCercanos(pool, input.aforo, 1).map((p) =>
        toVista(p, input.aforo),
      ),
    };
  }

  async obtenerPrecioPaquete(input: {
    sku?: string;
    paqueteId?: string;
    fecha?: string;
    aforo?: number;
  }) {
    const paquete = await this.findPaquete(input);
    if (!paquete) {
      return { error: "sin_paquete" as const };
    }
    const fechaConsulta = fechaConsultaDate(input.fecha);
    const precios = await this.prisma.paquetePrecio.findMany({
      where: {
        paqueteId: paquete.id,
        ...vigenciaWhere(fechaConsulta),
      },
      orderBy: { rangoMin: "asc" },
    });
    const match = matchPrecioPorAforo(precios, input.aforo);
    if (match.kind === "sin_interpolar") {
      return {
        error: "sin_tramo_exacto" as const,
        sku: paquete.codigoSku,
        paqueteId: paquete.id,
        nombre: paquete.nombre,
        aforo: match.aforo,
        tramosPublicados: match.tramosPublicados,
      };
    }
    if (match.kind === "sin_vigente") {
      return {
        error: "sin_precio_vigente" as const,
        sku: paquete.codigoSku,
        paqueteId: paquete.id,
        nombre: paquete.nombre,
      };
    }
    const fila = precios.find(
      (p) =>
        p.rangoMin === match.row.rangoMin &&
        p.rangoMax === match.row.rangoMax &&
        p.monto === match.row.monto,
    );
    return {
      sku: paquete.codigoSku,
      paqueteId: paquete.id,
      nombre: paquete.nombre,
      moneda: match.row.moneda,
      monto: match.row.monto,
      rangoMin: match.row.rangoMin,
      rangoMax: match.row.rangoMax,
      unidad: match.row.unidad,
      condiciones: fila?.condiciones ?? null,
      vigenteDesde: fila?.vigenteDesde,
      vigenteHasta: fila?.vigenteHasta,
      aforoTramo: match.aforoTramo,
      totalEvento: match.totalEvento,
      desde: match.kind === "desde",
      tramosPublicados: [...AFORO_TRAMOS_BODA],
    };
  }

  async listarInclusiones(input: { sku?: string; paqueteId?: string }) {
    const paquete = await this.findPaquete(input);
    if (!paquete) {
      return { error: "sin_paquete" as const };
    }
    const inclusiones = await this.prisma.paqueteInclusion.findMany({
      where: { paqueteId: paquete.id },
      orderBy: { orden: "asc" },
    });
    return {
      sku: paquete.codigoSku,
      paqueteId: paquete.id,
      nombre: paquete.nombre,
      inclusiones: inclusiones.map((i) => ({
        categoria: i.categoria,
        nombre: i.nombre,
        cantidad: i.cantidad,
        unidad: i.unidad,
        obligatoria: i.obligatoria,
      })),
    };
  }

  async compararPaquetes(input: {
    skus?: string[];
    ids?: string[];
    fecha?: string;
    aforo?: number;
  }) {
    const skus = (input.skus ?? []).map((s) => canonicalizeSku(s) ?? s);
    const ids = input.ids ?? [];
    const keys = [...skus, ...ids].slice(0, 3);
    const rows = [];
    for (const key of keys) {
      const paquete = await this.findPaquete(
        skus.includes(key) ? { sku: key } : { paqueteId: key },
      );
      if (!paquete) continue;
      const precio = await this.obtenerPrecioPaquete({
        paqueteId: paquete.id,
        fecha: input.fecha,
        aforo: input.aforo,
      });
      const inclusiones = await this.listarInclusiones({
        paqueteId: paquete.id,
      });
      rows.push({
        sku: paquete.codigoSku,
        nombre: paquete.nombre,
        aforoMin: paquete.aforoMin,
        aforoMax: paquete.aforoMax,
        precio: "error" in precio ? null : precio,
        precioError:
          "error" in precio
            ? {
                error: precio.error,
                tramosPublicados:
                  "tramosPublicados" in precio
                    ? precio.tramosPublicados
                    : undefined,
              }
            : null,
        inclusiones:
          "error" in inclusiones ? [] : inclusiones.inclusiones.slice(0, 8),
      });
    }
    return { items: rows };
  }

  async evaluarReglasPaquete(input: { sku?: string; paqueteId?: string }) {
    const paquete = await this.findPaquete(input);
    if (!paquete) {
      return { error: "sin_paquete" as const };
    }
    const reglas = await this.prisma.paqueteRegla.findMany({
      where: { paqueteId: paquete.id },
    });
    return {
      sku: paquete.codigoSku,
      paqueteId: paquete.id,
      nombre: paquete.nombre,
      reglas: reglas.map((r) => ({
        tipo: r.tipo,
        parametros: r.parametros,
        mensajeProspecto: r.mensajeProspecto,
      })),
    };
  }

  async findSkuBajoPiso(pisoMxn = PISO_INVERSION_MXN): Promise<{
    sku: string;
    nombre: string;
    monto: number;
  } | null> {
    const fechaConsulta = fechaConsultaDate();
    const rows = await this.prisma.paquetePrecio.findMany({
      where: {
        ...vigenciaWhere(fechaConsulta),
        monto: { gt: 0 },
        paquete: { estado: "publicado" },
      },
      include: { paquete: { select: { codigoSku: true, nombre: true } } },
    });
    return pickSkuBajoPiso(
      rows.map((r) => ({
        sku: r.paquete.codigoSku,
        nombre: r.paquete.nombre,
        monto: r.monto != null ? Number(r.monto) : null,
        moneda: r.moneda,
        unidad: r.unidad,
        rangoMin: r.rangoMin,
        rangoMax: r.rangoMax,
      })),
      pisoMxn,
    );
  }

  async findSkuPisoVigente(): Promise<{
    sku: string;
    nombre: string;
    monto: number;
  } | null> {
    const fechaConsulta = fechaConsultaDate();
    const paquetes = await this.prisma.paquete.findMany({
      where: { estado: "publicado" },
      include: {
        precios: {
          where: vigenciaWhere(fechaConsulta),
          orderBy: { rangoMin: "asc" },
        },
      },
    });
    return pickSkuPisoVigente(
      paquetes.map((p) => ({
        sku: p.codigoSku,
        nombre: p.nombre,
        precios: p.precios.map((r) => ({
          monto: r.monto != null ? Number(r.monto) : null,
          moneda: r.moneda,
          unidad: r.unidad,
          rangoMin: r.rangoMin,
          rangoMax: r.rangoMax,
        })),
      })),
    );
  }

  private async findPaquete(input: { sku?: string; paqueteId?: string }) {
    if (input.paqueteId) {
      return this.prisma.paquete.findUnique({ where: { id: input.paqueteId } });
    }
    const sku = canonicalizeSku(input.sku);
    if (sku) {
      return this.prisma.paquete.findUnique({
        where: { codigoSku: sku },
      });
    }
    return null;
  }
}
