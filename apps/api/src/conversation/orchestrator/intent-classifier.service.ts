import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isLiveAiProviders } from "../../config";
import { LLM_PORT } from "../../ports/tokens";
import type { LlmPort } from "../../ports/llm.port";
import type { IntentClasificado, PasoGuion } from "../types";
import { classifyIntentLexical } from "./routing.policies";
import { classifyIntentWithLlm } from "../script/script-llm.extract";

@Injectable()
export class IntentClassifierService {
  constructor(
    @Optional() @Inject(LLM_PORT) private readonly llm?: LlmPort,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async classify(input: {
    texto: string;
    pasoGuion: PasoGuion;
    buttonPayload?: string | null;
  }): Promise<IntentClasificado> {
    const lexical = classifyIntentLexical(
      input.texto,
      input.pasoGuion,
      input.buttonPayload,
    );
    if (lexical !== "ambiguo") return lexical;
    if (!this.llm || !isLiveAiProviders(this.config)) return lexical;

    const llmIntent = await classifyIntentWithLlm({
      llm: this.llm,
      texto: input.texto,
      pasoGuion: input.pasoGuion,
    });
    return llmIntent ?? lexical;
  }
}
