import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  COPY_V3_NUTRICION_T24,
  COPY_V3_NUTRICION_T7,
} from "../script/script-v2.copy";

export interface NurtureJob {
  conversacionId: string;
  toque: 1 | 2;
  scheduledFor: Date;
  nombre?: string | null;
  cancelado: boolean;
  plantillaId: "t24" | "t7";
}

/**
 * Nutrición determinista: 2 toques (T+24h, T+7d), sin LLM.
 * QUEUE_DRIVER=inline ejecuta en proceso (tests). bullmq reutiliza la misma cola local
 * si el paquete no está instalado.
 */
@Injectable()
export class NurtureWorkerService {
  private readonly logger = new Logger(NurtureWorkerService.name);
  private readonly jobs = new Map<string, NurtureJob[]>();

  constructor(@Optional() private readonly config?: ConfigService) {}

  driver(): "inline" | "bullmq" {
    const raw =
      this.config?.get<string>("queue.driver") ??
      this.config?.get<string>("QUEUE_DRIVER") ??
      process.env.QUEUE_DRIVER;
    return raw === "bullmq" ? "bullmq" : "inline";
  }

  schedule(input: {
    conversacionId: string;
    nombre?: string | null;
    consentimiento: boolean;
    now?: Date;
  }): NurtureJob[] {
    if (!input.consentimiento) return [];
    this.cancel(input.conversacionId);
    const now = input.now ?? new Date();
    const t1: NurtureJob = {
      conversacionId: input.conversacionId,
      toque: 1,
      scheduledFor: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      nombre: input.nombre,
      cancelado: false,
      plantillaId: "t24",
    };
    const t2: NurtureJob = {
      conversacionId: input.conversacionId,
      toque: 2,
      scheduledFor: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      nombre: input.nombre,
      cancelado: false,
      plantillaId: "t7",
    };
    this.jobs.set(input.conversacionId, [t1, t2]);
    this.logger.debug(
      `nurture programada ${input.conversacionId} driver=${this.driver()}`,
    );
    return [t1, t2];
  }

  cancel(conversacionId: string): void {
    const list = this.jobs.get(conversacionId);
    if (!list) return;
    for (const j of list) j.cancelado = true;
    this.jobs.delete(conversacionId);
  }

  list(conversacionId: string): NurtureJob[] {
    return this.jobs.get(conversacionId) ?? [];
  }

  copyFor(job: NurtureJob): string {
    return job.toque === 1
      ? COPY_V3_NUTRICION_T24(job.nombre)
      : COPY_V3_NUTRICION_T7(job.nombre);
  }

  processDue(now = new Date()): Array<{ job: NurtureJob; texto: string }> {
    const due: Array<{ job: NurtureJob; texto: string }> = [];
    for (const list of this.jobs.values()) {
      for (const job of list) {
        if (job.cancelado || job.scheduledFor > now) continue;
        due.push({ job, texto: this.copyFor(job) });
        job.cancelado = true;
      }
    }
    return due;
  }

  clear(): void {
    this.jobs.clear();
  }
}
