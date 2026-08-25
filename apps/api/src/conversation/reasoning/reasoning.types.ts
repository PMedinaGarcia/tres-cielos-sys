import type {
  ReasoningStep,
  ReasoningStepInput,
  ReasoningTrace,
  ReasoningTraceOutcome,
} from "@tres-cielos/shared";

export type {
  ReasoningLevel,
  ReasoningStep,
  ReasoningStepInput,
  ReasoningTrace,
  ReasoningTraceOutcome,
} from "@tres-cielos/shared";

export const REASONING_LEVELS = [
  "preflight",
  "intent",
  "routing",
  "gate_precio",
  "guion",
  "catalog_tools",
  "rag",
  "handoff",
  "outcome",
] as const;

export type { ReasoningStepInput as AppendableReasoningStep };

/** Re-export para consumidores API que no quieran depender del path shared. */
export type ReasoningTraceRecord = ReasoningTrace;
export type ReasoningStepRecord = ReasoningStep;
export type ReasoningOutcomeRecord = ReasoningTraceOutcome;
export type ReasoningStepDraft = ReasoningStepInput;
