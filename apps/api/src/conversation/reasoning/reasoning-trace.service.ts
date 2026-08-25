import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type {
  ReasoningStep,
  ReasoningStepInput,
  ReasoningTrace,
  ReasoningTraceOutcome,
} from "@tres-cielos/shared";

/**
 * Trace por turno: in-memory + AsyncLocalStorage.
 * Contrato listo para persistir en EventoOperativo / tabla dedicada.
 */
@Injectable()
export class ReasoningTraceService {
  private readonly als = new AsyncLocalStorage<string>();
  private readonly traces = new Map<string, ReasoningTrace>();

  async runWithTurn<T>(
    meta: { conversacionId: string; turnId: string },
    fn: (trace: ReasoningTrace) => Promise<T>,
  ): Promise<T> {
    const trace: ReasoningTrace = {
      id: randomUUID(),
      turnId: meta.turnId,
      conversacionId: meta.conversacionId,
      startedAt: new Date().toISOString(),
      steps: [],
    };
    this.traces.set(trace.id, trace);
    return this.als.run(trace.id, () => fn(trace));
  }

  current(): ReasoningTrace | undefined {
    const id = this.als.getStore();
    return id ? this.traces.get(id) : undefined;
  }

  currentId(): string | undefined {
    return this.als.getStore();
  }

  append(step: ReasoningStepInput): ReasoningStep {
    const trace = this.current();
    const full = {
      ...step,
      seq: trace?.steps.length ?? 0,
      at: new Date().toISOString(),
    } as ReasoningStep;
    if (trace) trace.steps.push(full);
    return full;
  }

  finish(outcome: ReasoningTraceOutcome): ReasoningTrace | undefined {
    const trace = this.current();
    if (!trace) return undefined;
    if (!trace.outcome) {
      this.append({
        level: "outcome",
        ruta: outcome.ruta,
        estadoBot: outcome.estadoBot ?? "activo",
        motivoHandoff: outcome.motivoHandoff,
        eventoOperativoId: outcome.eventoOperativoId,
        registroConsultaCatalogoId: outcome.registroConsultaCatalogoId,
        registroRecuperacionId: outcome.registroRecuperacionId,
      });
    }
    trace.outcome = outcome;
    trace.finishedAt = new Date().toISOString();
    return trace;
  }

  get(id: string): ReasoningTrace | undefined {
    return this.traces.get(id);
  }

  /** Tests */
  clear(): void {
    this.traces.clear();
  }
}
