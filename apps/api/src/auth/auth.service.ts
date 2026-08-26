import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Response } from "express";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CREDENTIALS_INVALID } from "./auth.constants";
import { clearAuthCookies, setAuthCookies } from "./auth.cookies";
import {
  durationToMs,
  jwtExpiresIn,
  sha256Hex,
  timingSafeEqualHex,
} from "./crypto.util";
import { verifyPassword } from "./password";
import type { AccessJwtPayload, RefreshJwtPayload } from "./auth.types";
import { toUserDto } from "./user-dto.mapper";
import type { UserDto } from "@tres-cielos/shared";

const userInclude = { sedes: true } as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  cookieOpts() {
    return {
      secure: this.config.get<boolean>("auth.cookieSecure") === true,
      domain: this.config.get<string>("auth.cookieDomain") || undefined,
      accessMaxAgeMs: durationToMs(
        this.config.get<string>("auth.jwtExpiresIn") ?? "15m",
      ),
      refreshMaxAgeMs: durationToMs(
        this.config.get<string>("auth.jwtRefreshExpiresIn") ?? "7d",
      ),
    };
  }

  expiresInSeconds(): number {
    return Math.floor(this.cookieOpts().accessMaxAgeMs / 1000);
  }

  async login(
    email: string,
    password: string,
    res: Response,
  ): Promise<{ user: UserDto; expiresIn: number }> {
    const user = await this.prisma.usuario.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: userInclude,
    });
    if (!user || !user.activo) {
      throw new UnauthorizedException(CREDENTIALS_INVALID);
    }
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      throw new UnauthorizedException(CREDENTIALS_INVALID);
    }
    await this.issueSession(user, res);
    return { user: toUserDto(user), expiresIn: this.expiresInSeconds() };
  }

  async me(userId: string): Promise<{ user: UserDto }> {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      include: userInclude,
    });
    if (!user || !user.activo) {
      throw new UnauthorizedException();
    }
    return { user: toUserDto(user) };
  }

  async refresh(
    refreshToken: string | undefined,
    res: Response,
  ): Promise<{ user: UserDto; expiresIn: number }> {
    if (!refreshToken) throw new UnauthorizedException();
    let payload: RefreshJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshJwtPayload>(refreshToken, {
        secret: this.config.get<string>("auth.jwtSecret"),
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.typ !== "refresh" || !payload.jti) {
      throw new UnauthorizedException();
    }
    const row = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });
    const hash = sha256Hex(refreshToken);
    if (
      !row ||
      row.revokedAt ||
      row.expiresAt.getTime() < Date.now() ||
      row.usuarioId !== payload.sub ||
      !timingSafeEqualHex(row.tokenHash, hash)
    ) {
      throw new UnauthorizedException();
    }
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    const user = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: userInclude,
    });
    if (!user || !user.activo) {
      throw new UnauthorizedException();
    }
    await this.issueSession(user, res);
    return { user: toUserDto(user), expiresIn: this.expiresInSeconds() };
  }

  async logout(refreshToken: string | undefined, res: Response): Promise<void> {
    if (refreshToken) {
      try {
        const payload = await this.jwt.verifyAsync<RefreshJwtPayload>(
          refreshToken,
          { secret: this.config.get<string>("auth.jwtSecret") },
        );
        if (payload.jti) {
          await this.prisma.refreshToken.updateMany({
            where: { id: payload.jti, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      } catch {
        /* still clear cookies */
      }
    }
    clearAuthCookies(res, this.cookieOpts());
  }

  async revokeAllRefresh(usuarioId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueSession(
    user: {
      id: string;
      email: string;
      nombre: string;
      rol: AccessJwtPayload["role"];
      organizacionId: string;
      activo: boolean;
      disponible: boolean;
      sedes: { sedeId: string }[];
    },
    res: Response,
  ) {
    const opts = this.cookieOpts();
    const refreshRow = await this.prisma.refreshToken.create({
      data: {
        usuarioId: user.id,
        tokenHash: `pending:${randomUUID()}`,
        expiresAt: new Date(Date.now() + opts.refreshMaxAgeMs),
      },
    });
    const secret = this.config.get<string>("auth.jwtSecret") ?? "";
    const accessPayload: AccessJwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.nombre,
      role: user.rol,
      sedeIds: user.sedes.map((s) => s.sedeId),
      orgId: user.organizacionId,
      flags: { activo: user.activo, disponible: user.disponible },
      sid: refreshRow.id,
      typ: "access",
    };
    const access = await this.jwt.signAsync(accessPayload, {
      secret,
      expiresIn: jwtExpiresIn(
        this.config.get<string>("auth.jwtExpiresIn") ?? "15m",
      ),
    });
    const refresh = await this.jwt.signAsync(
      { sub: user.id, jti: refreshRow.id, typ: "refresh" } satisfies RefreshJwtPayload,
      {
        secret,
        expiresIn: jwtExpiresIn(
          this.config.get<string>("auth.jwtRefreshExpiresIn") ?? "7d",
        ),
      },
    );
    await this.prisma.refreshToken.update({
      where: { id: refreshRow.id },
      data: { tokenHash: sha256Hex(refresh) },
    });
    setAuthCookies(res, { access, refresh }, opts);
  }
}
