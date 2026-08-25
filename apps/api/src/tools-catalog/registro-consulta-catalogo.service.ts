import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { ToolCatalogName } from "./tool-schemas";

export interface RegistroConsultaCatalogo {
  id: string;
  conversacionId: string;
  mensajeId?: string;
  tool: ToolCatalogName | string;
  input: Record<string, unknown>;
  output: unknown;
  ok: boolean;
  filasSku: string[];
  latenciaMs: number;
  creadoEn: string;
}

/**
 * Stub local hasta que Audit/Prisma expongan RegistroConsultaCatalogo.
 * Otros agentes pueden reemplazar por persistencia real.
 */
@Injectable()
export class RegistroConsultaCatalogoService {
  private readonly rows = new Map<string, RegistroConsultaCatalogo>();

  async create(
    input: Omit<RegistroConsultaCatalogo, "id" | "creadoEn">,
  ): Promise<RegistroConsultaCatalogo> {
    const row: RegistroConsultaCatalogo = {
      ...input,
      id: randomUUID(),
      creadoEn: new Date().toISOString(),
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<RegistroConsultaCatalogo | null> {
    return this.rows.get(id) ?? null;
  }

  listAll(): RegistroConsultaCatalogo[] {
    return [...this.rows.values()];
  }

  clear(): void {
    this.rows.clear();
  }
}
