import { Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
  cola: "comercial" | "atencion_general";
}

export interface PersistibleAssignment {
  asesorId: string;
  regla: "sede_disponibilidad_round_robin";
}

/**
 * F5 — sede → disponibilidad → round-robin (mínimo viable).
 * `assign()` alimenta el pipeline in-memory (stubs).
 * `pickAsesorPersistible()` usa Usuario real para FKs de Cliente/Oportunidad.
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

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  assign(input: {
    sedeId: string;
    oportunidadId?: string;
    motivoEscalacion?: string;
    cola?: "comercial" | "atencion_general";
  }): AssignmentResult {
    const pool = this.asesores.filter(
      (a) => a.sedeId === input.sedeId && a.disponible,
    );
    const candidates =
      pool.length > 0 ? pool : this.asesores.filter((a) => a.disponible);
    const fallback =
      candidates.length > 0
        ? candidates
        : [
            {
              id: "asesor-fallback",
              sedeId: input.sedeId,
              disponible: true,
              nombre: "Cola",
            },
          ];
    const routed =
      input.cola === "atencion_general" ? [...fallback].reverse() : fallback;

    const key = `${input.sedeId}:${input.cola ?? "comercial"}`;
    const idx = this.rrIndex.get(key) ?? 0;
    const pick = routed[idx % routed.length]!;
    this.rrIndex.set(key, idx + 1);

    return {
      asesorId: pick.id,
      regla: "sede_disponibilidad_round_robin",
      sedeId: input.sedeId,
      cola: input.cola ?? "comercial",
    };
  }

  async pickAsesorPersistible(input: {
    sedeId?: string | null;
  }): Promise<PersistibleAssignment | null> {
    if (!this.prisma || !process.env.DATABASE_URL) return null;
    const sedeId = input.sedeId ?? undefined;
    let asesores = await this.prisma.usuario.findMany({
      where: {
        rol: "asesor",
        activo: true,
        disponible: true,
        ...(sedeId ? { sedes: { some: { sedeId } } } : {}),
      },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (asesores.length === 0 && sedeId) {
      asesores = await this.prisma.usuario.findMany({
        where: { rol: "asesor", activo: true, disponible: true },
        orderBy: { id: "asc" },
        select: { id: true },
      });
    }
    if (asesores.length === 0) return null;
    const key = `db:${sedeId ?? "all"}`;
    const idx = this.rrIndex.get(key) ?? 0;
    const pick = asesores[idx % asesores.length]!;
    this.rrIndex.set(key, idx + 1);
    return {
      asesorId: pick.id,
      regla: "sede_disponibilidad_round_robin",
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
