import { Test } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
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
  const usuario = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };
  const asignacion = { updateMany: jest.fn() };
  const conversacion = { updateMany: jest.fn() };
  const memoriaCliente = { updateMany: jest.fn() };
  const tx = { usuario, asignacion, conversacion, memoriaCliente };
  const prisma = {
    sede: { count: jest.fn(), findMany: jest.fn() },
    usuario,
    asignacion,
    conversacion,
    memoriaCliente,
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
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

  it("cambia el rol de otro usuario", async () => {
    usuario.findFirst.mockResolvedValue({
      id: "asesor-1",
      rol: "asesor",
      organizacionId: admin.orgId,
      sedes: [{ sedeId: "sede-1" }],
      disponible: true,
    });
    usuario.update.mockResolvedValue({
      id: "asesor-1",
      nombre: "Ana",
      email: "ana@trescielos.local",
      rol: "coordinador",
      organizacionId: admin.orgId,
      disponible: true,
      activo: true,
      sedes: [{ sedeId: "sede-1" }],
    });
    const dto = await service.update(admin, "asesor-1", { rol: "coordinador" });
    expect(dto.rol).toBe("coordinador");
    expect(usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rol: "coordinador" }),
      }),
    );
  });

  it("no permite cambiar el propio rol", async () => {
    usuario.findFirst.mockResolvedValue({
      id: admin.userId,
      rol: "admin",
      organizacionId: admin.orgId,
      sedes: [],
    });
    await expect(
      service.update(admin, admin.userId, { rol: "asesor" }),
    ).rejects.toThrow("No puedes cambiar tu propio rol");
    expect(usuario.update).not.toHaveBeenCalled();
  });

  it("no degrada al único administrador", async () => {
    usuario.findFirst.mockResolvedValue({
      id: "admin-2",
      rol: "admin",
      organizacionId: admin.orgId,
      sedes: [],
    });
    usuario.count.mockResolvedValue(0);
    await expect(
      service.update(admin, "admin-2", { rol: "coordinador" }),
    ).rejects.toThrow("No puedes quitar el rol al único administrador");
    expect(usuario.update).not.toHaveBeenCalled();
  });

  it("rechaza dejar a la persona sin sedes", async () => {
    usuario.findFirst.mockResolvedValue({
      id: "asesor-1",
      rol: "asesor",
      organizacionId: admin.orgId,
      sedes: [{ sedeId: "sede-1" }],
    });
    await expect(
      service.update(admin, "asesor-1", { sedeIds: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(usuario.update).not.toHaveBeenCalled();
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

  it("no permite eliminarse a sí mismo si hay otro administrador", async () => {
    usuario.findFirst.mockResolvedValue({ id: admin.userId, rol: "admin" });
    usuario.count.mockResolvedValue(1);
    await expect(service.remove(admin, admin.userId)).rejects.toThrow(
      "No puedes eliminar tu propia cuenta",
    );
    expect(usuario.delete).not.toHaveBeenCalled();
  });

  it("no elimina al único administrador", async () => {
    usuario.findFirst.mockResolvedValue({ id: admin.userId, rol: "admin" });
    usuario.count.mockResolvedValue(0);
    await expect(service.remove(admin, admin.userId)).rejects.toThrow(
      "No puedes eliminar al único administrador",
    );
    expect(usuario.delete).not.toHaveBeenCalled();
  });

  it("404 si el usuario no es de la organización", async () => {
    usuario.findFirst.mockResolvedValue(null);
    await expect(service.remove(admin, "ajeno")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(usuario.delete).not.toHaveBeenCalled();
  });

  it("borra el usuario y suelta asignaciones vigentes y locks", async () => {
    usuario.findFirst.mockResolvedValue({ id: "asesor-1", rol: "asesor" });
    usuario.delete.mockResolvedValue({ id: "asesor-1" });
    await service.remove(admin, "asesor-1");
    expect(usuario.findFirst).toHaveBeenCalledWith({
      where: { id: "asesor-1", organizacionId: admin.orgId },
      select: { id: true, rol: true },
    });
    expect(asignacion.updateMany).toHaveBeenCalledWith({
      where: { usuarioDestinoId: "asesor-1", vigente: true },
      data: { vigente: false },
    });
    expect(conversacion.updateMany).toHaveBeenCalledWith({
      where: { asesorLockId: "asesor-1" },
      data: { asesorLockId: null },
    });
    expect(memoriaCliente.updateMany).toHaveBeenCalledWith({
      where: { asesorLockId: "asesor-1" },
      data: { asesorLockId: null },
    });
    expect(usuario.delete).toHaveBeenCalledWith({ where: { id: "asesor-1" } });
    expect(usuario.count).not.toHaveBeenCalled();
  });

  it("permite borrar un administrador si queda otro", async () => {
    usuario.findFirst.mockResolvedValue({ id: "admin-2", rol: "admin" });
    usuario.count.mockResolvedValue(1);
    usuario.delete.mockResolvedValue({ id: "admin-2" });
    await service.remove(admin, "admin-2");
    expect(usuario.delete).toHaveBeenCalledWith({ where: { id: "admin-2" } });
  });

  it("traduce una FK restante a conflicto", async () => {
    usuario.findFirst.mockResolvedValue({ id: "asesor-1", rol: "asesor" });
    usuario.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("fk", {
        code: "P2003",
        clientVersion: "6.0.0",
      }),
    );
    await expect(service.remove(admin, "asesor-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
