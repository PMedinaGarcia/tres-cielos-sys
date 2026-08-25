import { Controller, Get, Query } from "@nestjs/common";
import { CatalogToolsService } from "../tools-catalog/catalog-tools.service";
import { PrismaService } from "../prisma/prisma.service";

@Controller("catalog/sandbox")
export class CatalogSandboxController {
  constructor(
    private readonly tools: CatalogToolsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("packages")
  listPackages() {
    return this.prisma.paquete.findMany({
      orderBy: { codigoSku: "asc" },
      select: {
        id: true,
        codigoSku: true,
        nombre: true,
        tipoEvento: true,
        aforoMin: true,
        aforoMax: true,
        estado: true,
      },
    });
  }

  @Get("tools/buscar_paquetes")
  buscar(
    @Query("tipoEvento") tipoEvento: string,
    @Query("aforo") aforo?: string,
    @Query("sede") sede?: string,
    @Query("fecha") fecha?: string,
  ) {
    return this.tools.buscarPaquetes({
      tipoEvento,
      aforo: aforo != null ? Number(aforo) : undefined,
      sede,
      fecha,
    });
  }

  @Get("tools/obtener_precio_paquete")
  precio(
    @Query("sku") sku?: string,
    @Query("paqueteId") paqueteId?: string,
    @Query("fecha") fecha?: string,
  ) {
    return this.tools.obtenerPrecioPaquete({ sku, paqueteId, fecha });
  }

  @Get("tools/listar_inclusiones")
  inclusiones(
    @Query("sku") sku?: string,
    @Query("paqueteId") paqueteId?: string,
  ) {
    return this.tools.listarInclusiones({ sku, paqueteId });
  }

  @Get("tools/comparar_paquetes")
  comparar(@Query("skus") skus?: string) {
    const list = (skus ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return this.tools.compararPaquetes({ skus: list });
  }

  @Get("tools/evaluar_reglas_paquete")
  reglas(@Query("sku") sku?: string, @Query("paqueteId") paqueteId?: string) {
    return this.tools.evaluarReglasPaquete({ sku, paqueteId });
  }
}
