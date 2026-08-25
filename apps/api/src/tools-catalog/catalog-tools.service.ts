import { Injectable } from "@nestjs/common";
import { TipoEvento } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

function fechaConsultaDate(fecha?: string): Date {
  if (!fecha) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
  if (!m) return new Date();
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0),
  );
}

function vigenciaWhere(fechaConsulta: Date) {
  return {
    estado: "publicado" as const,
    vigenteDesde: { lte: fechaConsulta },
    OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fechaConsulta } }],
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
    const tipo = input.tipoEvento as TipoEvento;
    const fechaConsulta = fechaConsultaDate(input.fecha);
    const all = await this.prisma.paquete.findMany({
      where: {
        estado: "publicado",
        tipoEvento: tipo,
        ...(input.sede ? { sede: input.sede } : {}),
      },
      include: {
        precios: {
          where: vigenciaWhere(fechaConsulta),
          orderBy: { vigenteDesde: "desc" },
          take: 1,
        },
      },
      orderBy: { codigoSku: "asc" },
    });

    const filtered = all.filter((p) => {
      if (input.aforo == null) return true;
      return input.aforo >= p.aforoMin && input.aforo <= p.aforoMax;
    });

    return filtered.map((p) => ({
      id: p.id,
      sku: p.codigoSku,
      nombre: p.nombre,
      tipoEvento: p.tipoEvento,
      sede: p.sede,
      aforoMin: p.aforoMin,
      aforoMax: p.aforoMax,
      descripcionCorta: p.descripcionCorta,
      precioMuestra: p.precios[0]
        ? {
            monto: p.precios[0].monto,
            moneda: p.precios[0].moneda,
            unidad: p.precios[0].unidad,
          }
        : null,
    }));
  }

  async obtenerPrecioPaquete(input: {
    sku?: string;
    paqueteId?: string;
    fecha?: string;
  }) {
    const paquete = await this.findPaquete(input);
    if (!paquete) {
      return { error: "sin_paquete" as const };
    }
    const fechaConsulta = fechaConsultaDate(input.fecha);
    const precio = await this.prisma.paquetePrecio.findFirst({
      where: {
        paqueteId: paquete.id,
        ...vigenciaWhere(fechaConsulta),
      },
      orderBy: { vigenteDesde: "desc" },
    });
    if (!precio) {
      return {
        error: "sin_precio_vigente" as const,
        sku: paquete.codigoSku,
        paqueteId: paquete.id,
      };
    }
    return {
      sku: paquete.codigoSku,
      paqueteId: paquete.id,
      nombre: paquete.nombre,
      moneda: precio.moneda,
      monto: precio.monto,
      rangoMin: precio.rangoMin,
      rangoMax: precio.rangoMax,
      unidad: precio.unidad,
      condiciones: precio.condiciones,
      vigenteDesde: precio.vigenteDesde,
      vigenteHasta: precio.vigenteHasta,
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
  }) {
    const skus = input.skus ?? [];
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
        inclusiones:
          "error" in inclusiones ? [] : inclusiones.inclusiones.slice(0, 5),
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
      reglas: reglas.map((r) => ({
        tipo: r.tipo,
        parametros: r.parametros,
        mensajeProspecto: r.mensajeProspecto,
      })),
    };
  }

  private async findPaquete(input: { sku?: string; paqueteId?: string }) {
    if (input.paqueteId) {
      return this.prisma.paquete.findUnique({ where: { id: input.paqueteId } });
    }
    if (input.sku) {
      return this.prisma.paquete.findUnique({
        where: { codigoSku: input.sku },
      });
    }
    return null;
  }
}
