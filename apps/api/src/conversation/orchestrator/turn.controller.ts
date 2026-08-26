import {
  CanActivate,
  Controller,
  ExecutionContext,
  Injectable,
  Post,
  Body,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrchestratorService } from "./orchestrator.service";
import { InboundMessageDto } from "./dto/inbound-message.dto";
import { Public } from "../../common/public.decorator";

export { Public, IS_PUBLIC_KEY } from "../../common/public.decorator";

/**
 * Guard del endpoint sandbox turn.
 * Permite: APP_ENV=dev|test|staging  OR  header x-service-token == ORCHESTRATOR_TURN_TOKEN
 * No usa JWT de panel (06 — turn sandbox ≠ JWT).
 */
@Injectable()
export class TurnSandboxGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();
    const env = (this.config.get<string>("APP_ENV") ?? process.env.APP_ENV ?? "dev")
      .toLowerCase();
    if (env === "dev" || env === "test" || env === "staging") {
      return true;
    }
    const expected =
      this.config.get<string>("ORCHESTRATOR_TURN_TOKEN") ??
      process.env.ORCHESTRATOR_TURN_TOKEN;
    const token = req.headers["x-service-token"];
    if (expected && token && token === expected) {
      return true;
    }
    throw new UnauthorizedException(
      "POST /orchestrator/turn requiere APP_ENV=dev|staging|test o x-service-token válido",
    );
  }
}

@Controller("orchestrator")
export class TurnController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  /**
   * Sandbox / interno — body = InboundMessage sintético.
   * @Public solo efectivo en dev/staging vía TurnSandboxGuard (no JWT panel).
   */
  @Public()
  @Post("turn")
  @UseGuards(TurnSandboxGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async turn(@Body() body: InboundMessageDto) {
    const data = await this.orchestrator.handleTurn(body);
    return { data };
  }
}
