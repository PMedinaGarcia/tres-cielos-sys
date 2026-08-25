import { Injectable } from "@nestjs/common";
import type { RagPipelinePort, RagPipelineResult } from "./rag-pipeline.port";

/** Stub Fase B/C — RAG real lo cablea otro agente (Fase D). */
@Injectable()
export class StubRagPipeline implements RagPipelinePort {
  async answer(): Promise<RagPipelineResult> {
    return {
      ok: false,
      motivoFallo: "no_implementado",
      scoresRerank: [],
      fragmentoIds: [],
    };
  }
}
