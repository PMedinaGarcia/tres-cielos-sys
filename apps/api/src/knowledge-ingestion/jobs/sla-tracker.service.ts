import { Injectable } from "@nestjs/common";
import type { TipoMaterial } from "../contracts/media.types";
import { SLA_MS } from "../contracts/media.types";

export interface SlaRecord {
  tipo: TipoMaterial;
  elapsedMs: number;
  checksum: string;
  withinSla: boolean;
  budgetMs: number;
  at: string;
}

/**
 * Hooks SLA medibles (texto <60s, foto <90s, video <5min).
 */
@Injectable()
export class SlaTrackerService {
  private readonly records: SlaRecord[] = [];

  record(tipo: TipoMaterial, elapsedMs: number, checksum: string): SlaRecord {
    const budgetMs =
      tipo === "imagen"
        ? SLA_MS.foto
        : tipo === "video"
          ? SLA_MS.video
          : SLA_MS.texto;
    const entry: SlaRecord = {
      tipo,
      elapsedMs,
      checksum,
      withinSla: elapsedMs <= budgetMs,
      budgetMs,
      at: new Date().toISOString(),
    };
    this.records.push(entry);
    return entry;
  }

  latest(): SlaRecord | undefined {
    return this.records[this.records.length - 1];
  }

  all(): SlaRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records.length = 0;
  }
}
