import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { PanelUser } from "../auth.types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PanelUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: PanelUser }>();
    if (!req.user) {
      throw new Error("CurrentUser requiere JwtAuthGuard");
    }
    return req.user;
  },
);
