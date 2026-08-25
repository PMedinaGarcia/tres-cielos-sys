import { TariffScrubService } from "../scrub/tariff-scrub.service";
import { OcrPriceGateService } from "../ocr-price-gate.service";

describe("OcrPriceGateService E7 / D-MED-10", () => {
  const gate = new OcrPriceGateService(new TariffScrubService());

  it("0 montos en contexto y handoff material_ocr_tarifas si intención monetaria", () => {
    const decision = gate.evaluate({
      pregunta: "¿Cuánto cuesta según la foto?",
      intencionMonetaria: true,
      fragments: [
        {
          texto: "Cartel con precio $45,000 MXN y jardín al fondo",
          noRecuperablePrecio: true,
          origenDerivacion: "vision",
        },
      ],
    });
    expect(decision.action).toBe("tools_or_handoff");
    if (decision.action === "tools_or_handoff") {
      expect(decision.motivoHandoff).toBe("material_ocr_tarifas");
    }
    expect(gate.countAmounts(decision.contextTexts)).toBe(0);
  });

  it("strip amounts en prosa no monetaria", () => {
    const decision = gate.evaluate({
      pregunta: "¿Cómo se ve el jardín?",
      intencionMonetaria: false,
      fragments: [
        {
          texto: "Ambiente nocturno. Lista: $12,000 MXN",
          noRecuperablePrecio: true,
          origenDerivacion: "vision",
        },
      ],
    });
    expect(decision.action).toBe("strip_amounts");
    expect(gate.countAmounts(decision.contextTexts)).toBe(0);
  });
});
