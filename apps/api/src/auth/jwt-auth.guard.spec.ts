import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { ACCESS_COOKIE } from "./auth.constants";

describe("JwtAuthGuard", () => {
  it("401 sin cookie", async () => {
    const guard = new JwtAuthGuard(
      { verifyAsync: jest.fn() } as unknown as JwtService,
      { usuario: { findUnique: jest.fn() } } as unknown as PrismaService,
      { get: () => "secret" } as unknown as ConfigService,
    );
    await expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ cookies: {}, headers: {} }),
        }),
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("401 si activo=false aunque el JWT sea válido", async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: "u1",
        typ: "access",
        iat: Math.floor(Date.now() / 1000),
      }),
    };
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: "u1",
          activo: false,
          passwordChangedAt: null,
          sedes: [],
        }),
      },
    };
    const guard = new JwtAuthGuard(
      jwt as unknown as JwtService,
      prisma as unknown as PrismaService,
      { get: () => "secret" } as unknown as ConfigService,
    );
    await expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: { [ACCESS_COOKIE]: "tok" },
            headers: {},
          }),
        }),
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
