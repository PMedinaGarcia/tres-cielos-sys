import {
  applyNoRecuperablePrecioGate,
  assertNoInventedMontos,
  isIntencionMonetaria,
  stripMontosFromProse,
} from "./no-recuperable-precio.gate";

describe("no_recuperable_precio gate (C4 ≥80% branches)", () => {
  it("detecta intención monetaria", () => {
    expect(isIntencionMonetaria("¿Cuánto cuesta el paquete?")).toBe(true);
    expect(isIntencionMonetaria("¿dónde queda el jardín?")).toBe(false);
  });

  it("intención monetaria → force_tools (cualquier rama)", () => {
    expect(
      applyNoRecuperablePrecioGate({
        intencionMonetaria: true,
        rama: "rag",
        fragmentos: [{ id: "1", noRecuperablePrecio: true }],
      }),
    ).toBe("force_tools");

    expect(
      applyNoRecuperablePrecioGate({
        intencionMonetaria: true,
        rama: "tools",
      }),
    ).toBe("force_tools");

    expect(
      applyNoRecuperablePrecioGate({
        intencionMonetaria: true,
        rama: "otro",
      }),
    ).toBe("force_tools");
  });

  it("adjunto con tarifas + monetaria + filas → force_tools", () => {
    expect(
      applyNoRecuperablePrecioGate({
        intencionMonetaria: true,
        rama: "otro",
        adjuntoConTarifas: true,
        hayFilasCatalogo: true,
      }),
    ).toBe("force_tools");
  });

  it("adjunto con tarifas + monetaria + sin filas → handoff_material_ocr", () => {
    expect(
      applyNoRecuperablePrecioGate({
        intencionMonetaria: true,
        rama: "otro",
        adjuntoConTarifas: true,
        hayFilasCatalogo: false,
      }),
    ).toBe("handoff_material_ocr");
  });

  it("adjunto tarifas + monetaria sin saber filas → tools_or_handoff", () => {
    expect(
      applyNoRecuperablePrecioGate({
        intencionMonetaria: true,
        rama: "otro",
        adjuntoConTarifas: true,
      }),
    ).toBe("tools_or_handoff");
  });

  it("RAG solo fragmentos flageados + narrativa → prose sin montos", () => {
    expect(
      applyNoRecuperablePrecioGate({
        intencionMonetaria: false,
        rama: "rag",
        fragmentos: [
          { id: "a", noRecuperablePrecio: true },
          { id: "b", noRecuperablePrecio: true },
        ],
      }),
    ).toBe("rag_prose_sin_montos");
  });

  it("RAG con algunos flageados → prose sin montos", () => {
    expect(
      applyNoRecuperablePrecioGate({
        intencionMonetaria: false,
        rama: "rag",
        fragmentos: [
          { id: "a", noRecuperablePrecio: true },
          { id: "b", noRecuperablePrecio: false },
        ],
      }),
    ).toBe("rag_prose_sin_montos");
  });

  it("RAG sin flags → pass", () => {
    expect(
      applyNoRecuperablePrecioGate({
        intencionMonetaria: false,
        rama: "rag",
        fragmentos: [{ id: "a", noRecuperablePrecio: false }],
      }),
    ).toBe("pass");
  });

  it("RAG sin fragmentos → pass", () => {
    expect(
      applyNoRecuperablePrecioGate({
        intencionMonetaria: false,
        rama: "rag",
        fragmentos: [],
      }),
    ).toBe("pass");
  });

  it("rama tools no monetaria → pass", () => {
    expect(
      applyNoRecuperablePrecioGate({
        intencionMonetaria: false,
        rama: "tools",
      }),
    ).toBe("pass");
  });

  it("rama otro no monetaria → pass", () => {
    expect(
      applyNoRecuperablePrecioGate({
        intencionMonetaria: false,
        rama: "otro",
      }),
    ).toBe("pass");
  });

  it("stripMontosFromProse elimina cifras", () => {
    const out = stripMontosFromProse("El precio es $85,000 MXN y 12000 pesos");
    expect(out).not.toMatch(/85000|85,000|12000/i);
    expect(out).toContain("[monto omitido]");
  });

  it("assertNoInventedMontos: permite montos de tool", () => {
    expect(
      assertNoInventedMontos({
        respuesta: "Precio MXN 85000 por evento",
        montosPermitidos: [85000],
      }).ok,
    ).toBe(true);
  });

  it("assertNoInventedMontos: rechaza monto inventado", () => {
    const r = assertNoInventedMontos({
      respuesta: "Te cotizo en $99999",
      montosPermitidos: [85000],
    });
    expect(r.ok).toBe(false);
    expect(r.montosSospechosos.length).toBeGreaterThan(0);
  });
});
