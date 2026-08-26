import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RolUsuario } from "@tres-cielos/shared";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { PanelUser } from "../auth.types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const req = context.switchToHttp().getRequest<{ user?: PanelUser }>();
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
