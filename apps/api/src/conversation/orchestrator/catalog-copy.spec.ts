import {
  formatMonto,
  redactBuscarPaquetes,
  redactBusquedaVacia,
  redactInclusiones,
  redactSinPrecioVigente,
  redactSinTramoExacto,
} from "./catalog-copy";

describe("catalog-copy (prospecto)", () => {
  it("formatea montos MXN con miles", () => {
    expect(formatMonto("MXN", 2980)).toMatch(/MXN 2[,.]980/);
  });

  it("lista paquetes por nombre comercial y precio, sin SKU ni filtros", () => {
    const out = redactBuscarPaquetes([
      {
        sku: "EVT-J1-TC",
        nombre: "Paquete Estándar",
        aforoMin: 100,
        aforoMax: 300,
        precioTramo: "desde",
        precioMuestra: {
          monto: 2980,
          moneda: "MXN",
          unidad: "persona",
          aforoTramo: 100,
          totalEvento: 298000,
          desde: true,
        },
      },
    ]);
    expect(out.texto).toContain("Paquete Estándar");
    expect(out.texto).toContain("Tres Cielos Tequesquitengo");
    expect(out.texto).toMatch(/MXN 2[,.]980/);
    expect(out.texto).not.toContain("EVT-J1-TC");
    expect(out.texto).not.toMatch(/Esencial|Jardín 1/i);
    expect(out.texto).not.toMatch(/filtros/i);
    expect(out.texto).toMatch(/estándar o el premium/i);
    expect(out.montos).toEqual([2980]);
  });

  it("sin precio vigente no inventa montos", () => {
    const out = redactBuscarPaquetes([
      {
        sku: "EVT-J1-TC",
        nombre: "Paquete Estándar",
        aforoMin: 100,
        aforoMax: 300,
        precioTramo: "sin_vigente",
        precioMuestra: null,
      },
    ]);
    expect(out.texto).toMatch(/aún no hay precio publicado/i);
    expect(out.texto).toContain("Paquete Estándar");
    expect(out.texto).not.toMatch(/\$\s?\d/);
    expect(out.montos).toEqual([]);
  });

  it("búsqueda vacía por aforo explica y ofrece el más cercano", () => {
    const out = redactBusquedaVacia({
      motivo: "aforo",
      aforoLead: 20,
      aforoMinCatalogo: 100,
      aforoMaxCatalogo: 300,
      tipoEvento: "boda",
      cercanos: [
        {
          nombre: "Paquete Estándar",
          aforoMin: 100,
          aforoMax: 300,
          precioMuestra: {
            monto: 2980,
            moneda: "MXN",
            unidad: "persona",
            desde: true,
          },
        },
      ],
    });
    expect(out.texto).toContain("20 personas");
    expect(out.texto).toContain("Paquete Estándar");
    expect(out.texto).toMatch(/asesor/i);
    expect(out.texto).not.toMatch(/filtros/i);
    expect(out.montos).toEqual([2980]);
  });

  it("búsqueda vacía por tipo no sugiere un paquete de boda", () => {
    const out = redactBusquedaVacia({
      motivo: "tipo",
      tipoEvento: "xv",
      cercanos: [
        { nombre: "Paquete Estándar", aforoMin: 100, aforoMax: 300 },
      ],
    });
    expect(out.texto).toMatch(/XV años/i);
    expect(out.texto).not.toContain("Paquete Estándar");
    expect(out.texto).toMatch(/asesor/i);
  });

  it("sin_precio_vigente usa nombre comercial", () => {
    const out = redactSinPrecioVigente({
      error: "sin_precio_vigente",
      sku: "EVT-J1-TC",
      nombre: "Paquete Estándar",
    });
    expect(out.texto).toContain("Paquete Estándar");
    expect(out.texto).not.toContain("EVT-J1-TC");
    expect(out.texto).toMatch(/aún no hay precio vigente/i);
  });

  it("sin_tramo_exacto no interpola", () => {
    const out = redactSinTramoExacto({
      error: "sin_tramo_exacto",
      nombre: "Paquete Estándar",
      aforo: 120,
      tramosPublicados: [100, 150, 200, 250, 300],
    });
    expect(out.texto).toContain("120");
    expect(out.texto).toMatch(/no interpolo/i);
    expect(out.texto).toMatch(/asesor/i);
    expect(out.montos).toEqual([]);
  });

  it("lista inclusiones numeradas, con prioridad y puntuación", () => {
    const out = redactInclusiones({
      paqueteId: "pkg-1",
      nombre: "Paquete Estándar",
      inclusiones: [
        {
          nombre:
            "Evento de tres días: viernes cortesía, sábado gran evento y domingo parrillada",
          categoria: "otro",
        },
        {
          nombre:
            "Renta del jardín por 11 horas (estacionamiento, baños, áreas comunes)",
          categoria: "otro",
        },
        { nombre: "Suite nupcial queen size, dos noches", categoria: "otro" },
        { nombre: "Valet para el 100% de los invitados", categoria: "personal" },
        { nombre: "Capilla techada y consagrada", categoria: "otro" },
        {
          nombre: "Banquete 3 tiempos (50% res y 50% pollo o cerdo)",
          categoria: "catering",
        },
        { nombre: "DJ por todo el evento", categoria: "audio" },
        {
          nombre: "In House Planner (coordinación antes y durante el evento)",
          categoria: "personal",
        },
      ],
    });
    expect(out.texto).toMatch(/^El Paquete Estándar incluye:\n\n1\. /);
    expect(out.texto).toContain("1. Evento de tres días");
    expect(out.texto).toContain("2. Renta del jardín");
    expect(out.texto.indexOf("Capilla")).toBeLessThan(
      out.texto.indexOf("Banquete"),
    );
    expect(out.texto.indexOf("Banquete")).toBeLessThan(
      out.texto.indexOf("Suite nupcial"),
    );
    expect(out.texto.indexOf("Suite nupcial")).toBeLessThan(
      out.texto.indexOf("Valet"),
    );
    expect(out.texto).toMatch(/8\. In House Planner .+\./);
    expect(out.texto).not.toContain(";");
    expect(out.texto).not.toContain("EVT-J1-TC");
    expect(out.paqueteId).toBe("pkg-1");
  });

  it("con SKU antepone ficha a fondo y no recorta inclusiones", () => {
    const extra = Array.from({ length: 4 }, (_, i) => ({
      nombre: `Ítem extra ${i + 1}`,
      categoria: "otro",
    }));
    const out = redactInclusiones({
      sku: "EVT-J1-TC",
      paqueteId: "pkg-1",
      nombre: "Paquete Estándar",
      inclusiones: [
        { nombre: "Evento de tres días", categoria: "otro" },
        { nombre: "Renta del jardín por 11 horas", categoria: "otro" },
        { nombre: "Capilla techada y consagrada", categoria: "otro" },
        { nombre: "Banquete 3 tiempos", categoria: "catering" },
        { nombre: "DJ por todo el evento", categoria: "audio" },
        { nombre: "Suite nupcial queen size", categoria: "otro" },
        { nombre: "Valet para invitados", categoria: "personal" },
        { nombre: "In House Planner", categoria: "personal" },
        ...extra,
      ],
    });
    expect(out.texto).toMatch(/evento de tres días/i);
    expect(out.texto).toMatch(/no incluye/i);
    expect(out.texto).toMatch(/barra libre/i);
    expect(out.texto).toContain("Ítem extra 4");
    expect(out.texto).not.toMatch(/el resto está en la ficha/i);
  });

  it("sin inclusiones no inventa listado", () => {
    const out = redactInclusiones({
      nombre: "Paquete Estándar",
      inclusiones: [],
    });
    expect(out.texto).toMatch(/no tiene inclusiones publicadas/i);
    expect(out.texto).not.toMatch(/^\d+\./m);
  });
});
