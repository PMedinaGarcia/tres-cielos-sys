export interface CandidatoCarga {
  id: string;
  peso: number;
  sinContactar: number;
  abiertas: number;
  nuevosHoy: number;
  ultimoAsignadoEn: Date | null;
  topeSinContactar: number;
  topeAbiertas: number;
  topeNuevosDia: number | null;
  especialidades: string[];
  dentroDeHorario: boolean;
}

export interface ExplicacionCandidato {
  id: string;
  sinContactar: number;
  abiertas: number;
  peso: number;
  elegible: boolean;
  descarte?: string;
}

export type MotivoSinCandidato = "sin_disponibles" | "todos_en_tope";

export interface DecisionAsignacion {
  elegidoId: string | null;
  motivoCola: MotivoSinCandidato | null;
  explicacion: {
    candidatos: ExplicacionCandidato[];
    elegidoId: string | null;
    motivoCola: MotivoSinCandidato | null;
  };
}

/**
 * Menor carga sin contactar, ponderada por peso.
 * Desempata por abiertas y por quién lleva más tiempo sin recibir un lead.
 */
export function elegirAsesor(input: {
  candidatos: CandidatoCarga[];
  tipoEvento: string | null;
  preferirEspecialidad: boolean;
  excluirId?: string | null;
}): DecisionAsignacion {
  const filas: ExplicacionCandidato[] = input.candidatos.map((c) => {
    const descarte = descartar(c, input.excluirId ?? null);
    return {
      id: c.id,
      sinContactar: c.sinContactar,
      abiertas: c.abiertas,
      peso: c.peso,
      elegible: descarte == null,
      ...(descarte ? { descarte } : {}),
    };
  });

  let elegibles = input.candidatos.filter((c) => descartar(c, input.excluirId ?? null) == null);

  if (
    input.preferirEspecialidad &&
    input.tipoEvento &&
    elegibles.some((c) => c.especialidades.includes(input.tipoEvento!))
  ) {
    const tipo = input.tipoEvento;
    const especialistas = new Set(
      elegibles.filter((c) => c.especialidades.includes(tipo)).map((c) => c.id),
    );
    for (const fila of filas) {
      if (fila.elegible && !especialistas.has(fila.id)) {
        fila.elegible = false;
        fila.descarte = "sin_especialidad";
      }
    }
    elegibles = elegibles.filter((c) => especialistas.has(c.id));
  }

  if (elegibles.length === 0) {
    const motivoCola = motivoVacio(input.candidatos, input.excluirId ?? null);
    return {
      elegidoId: null,
      motivoCola,
      explicacion: { candidatos: filas, elegidoId: null, motivoCola },
    };
  }

  elegibles.sort(comparar);
  const elegidoId = elegibles[0]!.id;
  return {
    elegidoId,
    motivoCola: null,
    explicacion: { candidatos: filas, elegidoId, motivoCola: null },
  };
}

function descartar(c: CandidatoCarga, excluirId: string | null): string | null {
  if (excluirId && c.id === excluirId) return "excluido";
  if (!c.dentroDeHorario) return "fuera_de_horario";
  if (c.sinContactar >= c.topeSinContactar) return "tope_sin_contactar";
  if (c.abiertas >= c.topeAbiertas) return "tope_abiertas";
  if (c.topeNuevosDia != null && c.nuevosHoy >= c.topeNuevosDia) return "tope_dia";
  return null;
}

function motivoVacio(
  candidatos: CandidatoCarga[],
  excluirId: string | null,
): MotivoSinCandidato {
  const presentes = candidatos.filter((c) => c.id !== excluirId && c.dentroDeHorario);
  if (presentes.length === 0) return "sin_disponibles";
  const algunoBajoTope = presentes.some((c) => descartar(c, excluirId) == null);
  if (algunoBajoTope) return "sin_disponibles";
  const todosEnTope = presentes.every((c) => {
    const razon = descartar(c, excluirId);
    return (
      razon === "tope_sin_contactar" ||
      razon === "tope_abiertas" ||
      razon === "tope_dia"
    );
  });
  return todosEnTope ? "todos_en_tope" : "sin_disponibles";
}

function comparar(a: CandidatoCarga, b: CandidatoCarga): number {
  const pesoA = a.peso > 0 ? a.peso : 1;
  const pesoB = b.peso > 0 ? b.peso : 1;
  const cargaA = a.sinContactar / pesoA;
  const cargaB = b.sinContactar / pesoB;
  if (cargaA !== cargaB) return cargaA - cargaB;
  if (a.abiertas !== b.abiertas) return a.abiertas - b.abiertas;
  const tiempoA = a.ultimoAsignadoEn?.getTime() ?? Number.NEGATIVE_INFINITY;
  const tiempoB = b.ultimoAsignadoEn?.getTime() ?? Number.NEGATIVE_INFINITY;
  if (tiempoA !== tiempoB) return tiempoA - tiempoB;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}
