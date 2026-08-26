import {
  SKU_PAQUETE_ESTANDAR,
  SKU_PAQUETE_PREMIUM,
} from "@tres-cielos/shared";
import { planCatalogToolsFromText } from "./catalog-tool-plan";

const ALL = new Set([
  "buscar_paquetes",
  "obtener_precio_paquete",
  "listar_inclusiones",
  "comparar_paquetes",
  "evaluar_reglas_paquete",
  "transferir_a_humano",
]);

describe("planCatalogToolsFromText", () => {
  it("Precio genérico busca paquetes de boda", () => {
    const plan = planCatalogToolsFromText("Precio", ALL);
    expect(plan[0]?.name).toBe("buscar_paquetes");
    expect(plan[0]?.args.tipoEvento).toBe("boda");
  });

  it("esencial resuelve a Paquete Estándar", () => {
    const plan = planCatalogToolsFromText("cuanto sale el esencial", ALL);
    expect(plan[0]?.name).toBe("obtener_precio_paquete");
    expect(plan[0]?.args.sku).toBe(SKU_PAQUETE_ESTANDAR);
  });

  it("qué incluye sin SKU lista ambos paquetes", () => {
    const plan = planCatalogToolsFromText("qué incluye", ALL);
    expect(plan.map((p) => p.args.sku)).toEqual([
      SKU_PAQUETE_ESTANDAR,
      SKU_PAQUETE_PREMIUM,
    ]);
  });

  it("que tiene el estandar lista inclusiones, no precio", () => {
    const plan = planCatalogToolsFromText("que tiene el estandar", ALL);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.name).toBe("listar_inclusiones");
    expect(plan[0]?.args.sku).toBe(SKU_PAQUETE_ESTANDAR);
  });

  it("anticipo evalúa reglas del estándar", () => {
    const plan = planCatalogToolsFromText("cuál es el anticipo", ALL);
    expect(plan[0]?.name).toBe("evaluar_reglas_paquete");
    expect(plan[0]?.args.sku).toBe(SKU_PAQUETE_ESTANDAR);
  });

  it("XV no cotiza boda: transfiere", () => {
    const plan = planCatalogToolsFromText("precio para xv años", ALL);
    expect(plan[0]?.name).toBe("transferir_a_humano");
    expect(plan[0]?.args.motivo).toBe("sin_catalogo");
  });
});
