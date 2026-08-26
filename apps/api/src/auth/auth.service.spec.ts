import { Test } from "@nestjs/testing";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth.constants";
import { hashPassword } from "./password";

const SECRET = "test-secret-test-secret-test-ok!!";

function cookieRes() {
  const jar: Record<string, string> = {};
  const res = {
    cookie: (name: string, value: string) => {
      jar[name] = value;
    },
    clearCookie: jest.fn(),
  } as unknown as Response;
  return { res, jar };
}

describe("AuthService", () => {
  const prisma = {
    usuario: { findUnique: jest.fn() },
    refreshToken: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  let service: AuthService;
  const userRow = {
    id: "u1",
    email: "ana@trescielos.local",
    nombre: "Ana",
    rol: "asesor" as const,
    organizacionId: "org-1",
    activo: true,
    disponible: true,
    passwordHash: "",
    passwordChangedAt: null as Date | null,
    sedes: [{ sedeId: "sede-1" }],
  };

  beforeAll(async () => {
    userRow.passwordHash = await hashPassword("CorrectHorse9x");
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.refreshToken.create.mockImplementation(async () => ({
      id: "rt-1",
    }));
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SECRET })],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              (
                ({
                  "auth.jwtSecret": SECRET,
                  "auth.jwtExpiresIn": "15m",
                  "auth.jwtRefreshExpiresIn": "7d",
                  "auth.cookieSecure": false,
                  "auth.cookieDomain": undefined,
                }) as Record<string, unknown>
              )[key],
          },
        },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it("login emite cookies y user sin accessToken en body", async () => {
    prisma.usuario.findUnique.mockResolvedValue(userRow);
    const { res, jar } = cookieRes();
    const out = await service.login(userRow.email, "CorrectHorse9x", res);
    expect(out.user.email).toBe(userRow.email);
    expect(out.expiresIn).toBe(900);
    expect(jar[ACCESS_COOKIE]).toBeTruthy();
    expect(jar[REFRESH_COOKIE]).toBeTruthy();
    expect(out).not.toHaveProperty("accessToken");
  });

  it("login rechaza password incorrecta con mensaje genérico", async () => {
    prisma.usuario.findUnique.mockResolvedValue(userRow);
    const { res } = cookieRes();
    await expect(
      service.login(userRow.email, "wrong-password-1", res),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("login rechaza usuario inactivo", async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...userRow, activo: false });
    const { res } = cookieRes();
    await expect(
      service.login(userRow.email, "CorrectHorse9x", res),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("refresh rota el token y logout lo revoca", async () => {
    prisma.usuario.findUnique.mockResolvedValue(userRow);
    const first = cookieRes();
    await service.login(userRow.email, "CorrectHorse9x", first.res);
    const refreshJwt = first.jar[REFRESH_COOKIE];
    const hash = require("crypto")
      .createHash("sha256")
      .update(refreshJwt)
      .digest("hex");
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      usuarioId: userRow.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
    });
    prisma.refreshToken.create.mockImplementation(async () => ({
      id: "rt-2",
    }));
    const second = cookieRes();
    const out = await service.refresh(refreshJwt, second.res);
    expect(out.user.id).toBe(userRow.id);
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rt-1" },
        data: { revokedAt: expect.any(Date) },
      }),
    );

    await service.logout(second.jar[REFRESH_COOKIE], second.res);
    expect(second.res.clearCookie).toHaveBeenCalled();
  });
});
