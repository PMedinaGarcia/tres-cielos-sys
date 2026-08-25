import { randomUUID } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { TurnSandboxGuard } from "../conversation/orchestrator/turn.controller";
import { ReasoningTraceService } from "../conversation/reasoning/reasoning-trace.service";
import { InboundPipelineService } from "./inbound-pipeline.service";
import { SandboxInboundDto } from "./dto/sandbox-inbound.dto";
import type { Canal, InboundMessage } from "./types/inbound-message";

/**
 * Chat sandbox HTTP — mismo InboundPipelineService que Twilio/Meta.
 * Sin firma de canal; auth = TurnSandboxGuard (APP_ENV o x-service-token).
 */
@Controller("channels/sandbox")
export class ChannelSandboxController {
  constructor(
    private readonly pipeline: InboundPipelineService,
    private readonly reasoning: ReasoningTraceService,
  ) {}

  @Post("inbound")
  @UseGuards(TurnSandboxGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async inbound(@Body() body: SandboxInboundDto) {
    const canal = normalizeCanal(body.canal);
    const message: InboundMessage = {
      canal,
      externalThreadId:
        body.externalThreadId ?? body.threadId ?? "sandbox-web",
      externalMessageId: body.externalMessageId ?? randomUUID(),
      texto: body.texto,
      recibidoEn: body.recibidoEn ?? new Date().toISOString(),
      perfilCanal: body.perfilCanal,
      meta: { sandbox: true, ...(body.meta ?? {}) },
    };

    const result = await this.pipeline.process(message);
    if ("duplicate" in result) {
      return { data: { duplicate: true as const } };
    }

    const trace =
      result.reasoningTrace ??
      (result.reasoningTraceId
        ? this.reasoning.get(result.reasoningTraceId)
        : undefined);

    return {
      data: {
        ...result,
        reasoningTrace: trace ?? result.reasoningTrace ?? null,
      },
    };
  }

  @Get("turns/:traceId")
  @UseGuards(TurnSandboxGuard)
  getTrace(@Param("traceId") traceId: string) {
    const trace = this.reasoning.get(traceId);
    if (!trace) {
      throw new NotFoundException(`ReasoningTrace no encontrado: ${traceId}`);
    }
    return { data: trace };
  }
}

function normalizeCanal(raw?: string): Canal {
  if (raw === "instagram" || raw === "facebook" || raw === "whatsapp") {
    return raw;
  }
  return "whatsapp";
}
