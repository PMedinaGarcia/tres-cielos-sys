import { elegirAsesor, type CandidatoCarga } from "./elegir-asesor";

function candidato(over: Partial<CandidatoCarga> & { id: string }): CandidatoCarga {
  return {
    peso: 1,
    sinContactar: 0,
    abiertas: 0,
    nuevosHoy: 0,
    ultimoAsignadoEn: null,
    topeSinContactar: 8,
    topeAbiertas: 40,
    topeNuevosDia: null,
    especialidades: [],
    dentroDeHorario: true,
    ...over,
  };
}

describe("elegirAsesor", () => {
  it("elige a quien tiene menos leads sin contactar", () => {
    const decision = elegirAsesor({
      tipoEvento: null,
      preferirEspecialidad: false,
      candidatos: [
        candidato({ id: "ana", sinContactar: 3, abiertas: 1 }),
        candidato({ id: "luis", sinContactar: 1, abiertas: 9 }),
      ],
    });
    expect(decision.elegidoId).toBe("luis");
    expect(decision.motivoCola).toBeNull();
  });

  it("con la misma carga desempata por la última asignación y luego por id", () => {
    const viejo = elegirAsesor({
      tipoEvento: null,
      preferirEspecialidad: false,
      candidatos: [
        candidato({
          id: "ana",
          ultimoAsignadoEn: new Date("2026-11-01T18:00:00Z"),
        }),
        candidato({
          id: "luis",
          ultimoAsignadoEn: new Date("2026-11-01T12:00:00Z"),
        }),
      ],
    });
    expect(viejo.elegidoId).toBe("luis");

    const estable = elegirAsesor({
      tipoEvento: null,
      preferirEspecialidad: false,
      candidatos: [candidato({ id: "luis" }), candidato({ id: "ana" })],
    });
    expect(estable.elegidoId).toBe("ana");
  });

  it("un medio tiempo recibe menos que un tiempo completo con la misma cola", () => {
    const decision = elegirAsesor({
      tipoEvento: null,
      preferirEspecialidad: false,
      candidatos: [
        candidato({ id: "medio", peso: 0.5, sinContactar: 2 }),
        candidato({ id: "completo", peso: 1, sinContactar: 3 }),
      ],
    });
    expect(decision.elegidoId).toBe("completo");
  });

  it("deja fuera a quien llegó al tope y explica el descarte", () => {
    const decision = elegirAsesor({
      tipoEvento: null,
      preferirEspecialidad: false,
      candidatos: [
        candidato({ id: "ana", sinContactar: 8, topeSinContactar: 8 }),
        candidato({ id: "luis", sinContactar: 2 }),
      ],
    });
    expect(decision.elegidoId).toBe("luis");
    expect(decision.explicacion.candidatos.find((c) => c.id === "ana")?.descarte).toBe(
      "tope_sin_contactar",
    );
  });

  it("si todos están en tope, manda la cola de coordinador", () => {
    const decision = elegirAsesor({
      tipoEvento: null,
      preferirEspecialidad: false,
      candidatos: [candidato({ id: "ana", abiertas: 40, topeAbiertas: 40 })],
    });
    expect(decision.elegidoId).toBeNull();
    expect(decision.motivoCola).toBe("todos_en_tope");
  });

  it("sin nadie en horario no hay disponibles", () => {
    const decision = elegirAsesor({
      tipoEvento: null,
      preferirEspecialidad: false,
      candidatos: [candidato({ id: "ana", dentroDeHorario: false })],
    });
    expect(decision.motivoCola).toBe("sin_disponibles");
  });

  it("prefiere al especialista y cae al pool general si nadie cubre el evento", () => {
    const conEspecialista = elegirAsesor({
      tipoEvento: "boda",
      preferirEspecialidad: true,
      candidatos: [
        candidato({ id: "ana", sinContactar: 0, especialidades: ["corporativo"] }),
        candidato({ id: "luis", sinContactar: 2, especialidades: ["boda"] }),
      ],
    });
    expect(conEspecialista.elegidoId).toBe("luis");

    const general = elegirAsesor({
      tipoEvento: "xv",
      preferirEspecialidad: true,
      candidatos: [
        candidato({ id: "ana", sinContactar: 1, especialidades: ["boda"] }),
        candidato({ id: "luis", sinContactar: 0, especialidades: ["corporativo"] }),
      ],
    });
    expect(general.elegidoId).toBe("luis");
  });

  it("no reasigna al asesor excluido por SLA", () => {
    const decision = elegirAsesor({
      tipoEvento: null,
      preferirEspecialidad: false,
      excluirId: "ana",
      candidatos: [
        candidato({ id: "ana", sinContactar: 0 }),
        candidato({ id: "luis", sinContactar: 4 }),
      ],
    });
    expect(decision.elegidoId).toBe("luis");
  });
});
