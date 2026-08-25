import { Injectable } from "@nestjs/common";
import { CatalogSnapshot } from "@tres-cielos/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CatalogSeedService {
  constructor(private readonly prisma: PrismaService) {}

  async seedFromSnapshot(
    snapshot: CatalogSnapshot,
    archivo = "golden-snapshot.json",
  ) {
    const iniciadoEn = new Date();
    let filasOk = 0;
    const errores: { sku?: string; motivo: string }[] = [];

    for (const p of snapshot.paquetes) {
      try {
        await this.prisma.paquete.upsert({
          where: { codigoSku: p.sku },
          create: {
            codigoSku: p.sku,
            nombre: p.nombre,
            tipoEvento: p.tipo_evento,
            sede: p.sede ?? null,
            aforoMin: p.aforo_min,
            aforoMax: p.aforo_max,
            descripcionCorta: p.descripcion_corta ?? null,
            estado: p.estado,
          },
          update: {
            nombre: p.nombre,
            tipoEvento: p.tipo_evento,
            sede: p.sede ?? null,
            aforoMin: p.aforo_min,
            aforoMax: p.aforo_max,
            descripcionCorta: p.descripcion_corta ?? null,
            estado: p.estado,
          },
        });
        filasOk += 1;
      } catch (e) {
        errores.push({
          sku: p.sku,
          motivo: e instanceof Error ? e.message : "error paquete",
        });
      }
    }

    for (const p of snapshot.paquetes) {
      const paquete = await this.prisma.paquete.findUnique({
        where: { codigoSku: p.sku },
      });
      if (!paquete) continue;

      await this.prisma.paquetePrecio.deleteMany({
        where: { paqueteId: paquete.id },
      });
      await this.prisma.paqueteInclusion.deleteMany({
        where: { paqueteId: paquete.id },
      });
      await this.prisma.paqueteRegla.deleteMany({
        where: { paqueteId: paquete.id },
      });
    }

    for (const pr of snapshot.precios) {
      const paquete = await this.prisma.paquete.findUnique({
        where: { codigoSku: pr.sku },
      });
      if (!paquete) {
        errores.push({ sku: pr.sku, motivo: "precio sin paquete" });
        continue;
      }
      await this.prisma.paquetePrecio.create({
        data: {
          paqueteId: paquete.id,
          moneda: pr.moneda,
          monto: pr.monto ?? null,
          rangoMin: pr.rango_min ?? null,
          rangoMax: pr.rango_max ?? null,
          unidad: pr.unidad,
          vigenteDesde: new Date(pr.vigente_desde),
          vigenteHasta: pr.vigente_hasta
            ? new Date(pr.vigente_hasta)
            : null,
          condiciones: pr.condiciones ?? null,
          estado: "publicado",
        },
      });
      filasOk += 1;
    }

    let orden = 0;
    for (const inc of snapshot.inclusiones) {
      const paquete = await this.prisma.paquete.findUnique({
        where: { codigoSku: inc.sku },
      });
      if (!paquete) {
        errores.push({ sku: inc.sku, motivo: "inclusion sin paquete" });
        continue;
      }
      await this.prisma.paqueteInclusion.create({
        data: {
          paqueteId: paquete.id,
          categoria: inc.categoria,
          nombre: inc.nombre,
          cantidad: inc.cantidad ?? null,
          unidad: inc.unidad ?? null,
          obligatoria: inc.obligatoria,
          orden: orden++,
        },
      });
      filasOk += 1;
    }

    for (const r of snapshot.reglas) {
      const paquete = await this.prisma.paquete.findUnique({
        where: { codigoSku: r.sku },
      });
      if (!paquete) {
        errores.push({ sku: r.sku, motivo: "regla sin paquete" });
        continue;
      }
      let parametros: object | null = null;
      if (r.parametros_json) {
        try {
          parametros = JSON.parse(r.parametros_json) as object;
        } catch {
          parametros = { raw: r.parametros_json };
        }
      }
      await this.prisma.paqueteRegla.create({
        data: {
          paqueteId: paquete.id,
          tipo: r.tipo,
          parametros: parametros ?? undefined,
          mensajeProspecto: r.mensaje_prospecto ?? null,
        },
      });
      filasOk += 1;
    }

    const resultado =
      errores.length === 0
        ? "exito"
        : filasOk > 0
          ? "parcial"
          : "fallo";

    await this.prisma.importacionCatalogo.create({
      data: {
        actor: "sandbox",
        archivo,
        iniciadoEn,
        terminadoEn: new Date(),
        filasOk,
        filasError: errores.length,
        detalleErrores: errores,
        resultado,
      },
    });

    return { filasOk, filasError: errores.length, errores, resultado };
  }
}
