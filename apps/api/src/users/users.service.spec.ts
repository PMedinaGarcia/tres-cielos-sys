import { Test } from "@nestjs/testing";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { UsersService } from "./users.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import type { PanelUser } from "../auth/auth.types";

const admin: PanelUser = {
  userId: "admin-1",
  email: "admin@trescielos.local",
  name: "Admin",
  role: "admin",
  sedeIds: ["sede-1"],
  orgId: "org-1",
  flags: { activo: true, disponible: true },
};

describe("UsersService", () => {
  const prisma = {
    sede: { count: jest.fn(), findMany: jest.fn() },
    usuario: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const auth = { revokeAllRefresh: jest.fn() };
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it("create persiste hash y no lo devuelve", async () => {
    prisma.sede.count.mockResolvedValue(1);
    prisma.usuario.create.mockResolvedValue({
      id: "u2",
      nombre: "Ana",
      email: "ana@trescielos.local",
      rol: "asesor",
      organizacionId: "org-1",
      disponible: true,
      activo: true,
      passwordHash: "should-not-leak",
      sedes: [{ sedeId: "sede-1" }],
    });
    const dto = await service.create(admin, {
      nombre: "Ana",
      email: "ana@trescielos.local",
      password: "CorrectHorse9x",
      rol: "asesor",
      sedeIds: ["sede-1"],
    });
    expect(dto).not.toHaveProperty("passwordHash");
    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "ana@trescielos.local",
          passwordHash: expect.stringMatching(/^\$argon2/),
        }),
      }),
    );
  });

  it("create duplicado → 409", async () => {
    prisma.sede.count.mockResolvedValue(1);
    prisma.usuario.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "6.0.0",
      }),
    );
    await expect(
      service.create(admin, {
        nombre: "Ana",
        email: "ana@trescielos.local",
        password: "CorrectHorse9x",
        rol: "asesor",
        sedeIds: ["sede-1"],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("no permite desactivarse a sí mismo", async () => {
    prisma.usuario.findFirst.mockResolvedValue({
      id: admin.userId,
      organizacionId: admin.orgId,
      sedes: [],
    });
    await expect(
      service.update(admin, admin.userId, { activo: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
