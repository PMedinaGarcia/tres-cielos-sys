import { Injectable } from "@nestjs/common";

export interface AsesorStub {
  id: string;
  sedeId: string;
  disponible: boolean;
  nombre: string;
}

export interface AssignmentResult {
  asesorId: string;
  regla: "sede_disponibilidad_round_robin";
  sedeId: string;
}

/**
 * F5 — sede → disponibilidad → round-robin (mínimo viable).
 */
@Injectable()
export class AssignmentService {
  private readonly asesores: AsesorStub[] = [
    {
      id: "asesor-ana",
      sedeId: "sede-default",
      disponible: true,
      nombre: "Ana Ruiz",
    },
    {
      id: "asesor-luis",
      sedeId: "sede-default",
      disponible: true,
      nombre: "Luis Pérez",
    },
    {
      id: "asesor-mia",
      sedeId: "sede-jardin-2",
      disponible: true,
      nombre: "Mia Soto",
    },
  ];

  private readonly rrIndex = new Map<string, number>();

  assign(input: {
    sedeId: string;
    oportunidadId?: string;
    motivoEscalacion?: string;
  }): AssignmentResult {
    const pool = this.asesores.filter(
      (a) => a.sedeId === input.sedeId && a.disponible,
    );
    const candidates =
      pool.length > 0
        ? pool
        : this.asesores.filter((a) => a.disponible);
    const fallback =
      candidates.length > 0
        ? candidates
        : [{ id: "asesor-fallback", sedeId: input.sedeId, disponible: true, nombre: "Cola" }];

    const idx = this.rrIndex.get(input.sedeId) ?? 0;
    const pick = fallback[idx % fallback.length]!;
    this.rrIndex.set(input.sedeId, idx + 1);

    return {
      asesorId: pick.id,
      regla: "sede_disponibilidad_round_robin",
      sedeId: input.sedeId,
    };
  }

  setDisponible(asesorId: string, disponible: boolean): void {
    const a = this.asesores.find((x) => x.id === asesorId);
    if (a) a.disponible = disponible;
  }

  list(): AsesorStub[] {
    return [...this.asesores];
  }
}
