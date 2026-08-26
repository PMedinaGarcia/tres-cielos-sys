import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { ACCESS_COOKIE } from "../auth.constants";
import type { AccessJwtPayload, PanelUser } from "../auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      cookies?: Record<string, string>;
      headers: Record<string, string | undefined>;
      user?: PanelUser;
    }>();
    const token =
      req.cookies?.[ACCESS_COOKIE] ?? bearer(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException();
    }
    let payload: AccessJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessJwtPayload>(token, {
        secret: this.config.get<string>("auth.jwtSecret"),
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.typ !== "access" || !payload.sub) {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: { sedes: true },
    });
    if (!user || !user.activo) {
      throw new UnauthorizedException();
    }
    if (
      user.passwordChangedAt &&
      payload.iat &&
      payload.iat * 1000 < user.passwordChangedAt.getTime()
    ) {
      throw new UnauthorizedException();
    }
    req.user = {
      userId: user.id,
      email: user.email,
      name: user.nombre,
      role: user.rol,
      sedeIds: user.sedes.map((s) => s.sedeId),
      orgId: user.organizacionId,
      flags: { activo: user.activo, disponible: user.disponible },
    };
    return true;
  }
}

function bearer(header?: string): string | undefined {
  if (!header) return undefined;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return undefined;
  return value;
}
