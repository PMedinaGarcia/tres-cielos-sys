import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { CatalogToolsService } from "../tools-catalog/catalog-tools.service";

type Expectation = Record<string, unknown>;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function runCase(
  tools: CatalogToolsService,
  tool: string,
  input: Record<string, unknown>,
  expect: Expectation,
) {
  switch (tool) {
    case "obtener_precio_paquete": {
      const res = await tools.obtenerPrecioPaquete({
        sku: input.sku as string,
        aforo: input.aforo as number | undefined,
        fecha: input.fecha as string | undefined,
      });
      if (expect.error) {
        assert(
          "error" in res && res.error === expect.error,
          `expected error ${expect.error}, got ${JSON.stringify(res)}`,
        );
        return;
      }
      assert(!("error" in res), `unexpected error ${JSON.stringify(res)}`);
      assert(res.sku === expect.sku, `sku ${res.sku} != ${expect.sku}`);
      assert(res.monto === expect.monto, `monto ${res.monto} != ${expect.monto}`);
      assert(
        res.moneda === expect.moneda,
        `moneda ${res.moneda} != ${expect.moneda}`,
      );
      return;
    }
    case "listar_inclusiones": {
      const res = await tools.listarInclusiones({ sku: input.sku as string });
      assert(!("error" in res), JSON.stringify(res));
      if ("error" in res) return;
      assert(
        res.inclusiones.length >= Number(expect.minCount),
        `inclusiones count`,
      );
      assert(res.sku === expect.sku, "sku mismatch");
      return;
    }
    case "buscar_paquetes": {
      const res = await tools.buscarPaquetes({
        tipoEvento: input.tipoEvento as string,
        aforo: input.aforo as number | undefined,
      });
      if (expect.empty) {
        assert(res.length === 0, `expected empty, got ${res.length}`);
        return;
      }
      if (expect.minCount != null) {
        assert(res.length >= Number(expect.minCount), "minCount");
      }
      if (expect.includesSku) {
        assert(
          res.some((r) => r.sku === expect.includesSku),
          `missing sku ${expect.includesSku}`,
        );
      }
      return;
    }
    case "comparar_paquetes": {
      const res = await tools.compararPaquetes({
        skus: input.skus as string[],
      });
      assert(res.items.length === Number(expect.count), "compare count");
      const montos = (expect.montos as number[]) ?? [];
      for (const m of montos) {
        assert(
          res.items.some((i) => i.precio && i.precio.monto === m),
          `missing monto ${m}`,
        );
      }
      return;
    }
    case "evaluar_reglas_paquete": {
      const res = await tools.evaluarReglasPaquete({
        sku: input.sku as string,
      });
      assert(!("error" in res), JSON.stringify(res));
      if ("error" in res) return;
      assert(res.reglas.length >= Number(expect.minCount), "reglas minCount");
      if (expect.tipo) {
        assert(
          res.reglas.some((r) => r.tipo === expect.tipo),
          `missing tipo ${expect.tipo}`,
        );
      }
      return;
    }
    default:
      throw new Error(`unknown tool ${tool}`);
  }
}

async function main() {
  const fixtures = path.resolve(__dirname, "../../../../fixtures/catalog");
  const cases = JSON.parse(
    fs.readFileSync(path.join(fixtures, "golden-qa.json"), "utf8"),
  ) as {
    id: string;
    tool: string;
    input: Record<string, unknown>;
    expect: Expectation;
  }[];

  const prisma = new PrismaClient();
  const tools = new CatalogToolsService(prisma as never);

  try {
    for (const c of cases) {
      await runCase(tools, c.tool, c.input, c.expect);
      // eslint-disable-next-line no-console
      console.log(`PASS ${c.id}`);
    }
    // eslint-disable-next-line no-console
    console.log(`sandbox:eval OK (${cases.length} cases)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
