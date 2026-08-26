import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { assertPasswordPolicy } from "../auth/crypto.util";
import { hashPassword } from "../auth/password";
import { toUserDto } from "../auth/user-dto.mapper";
import type { PanelUser } from "../auth/auth.types";
import type { CreateUserDto, SetCredentialsDto, UpdateUserDto } from "./dto/users.dto";

const userInclude = { sedes: true } as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async list(orgId: string) {
    const rows = await this.prisma.usuario.findMany({
      where: { organizacionId: orgId },
      include: userInclude,
      orderBy: { creadoEn: "asc" },
    });
    return rows.map(toUserDto);
  }

  async listSedes(orgId: string) {
    return this.prisma.sede.findMany({
      where: { organizacionId: orgId },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, activa: true },
    });
  }

  async create(actor: PanelUser, dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();
    assertPasswordPolicy(dto.password, email);
    await this.assertSedesInOrg(actor.orgId, dto.sedeIds);
    const passwordHash = await hashPassword(dto.password);
    try {
      const user = await this.prisma.usuario.create({
        data: {
          nombre: dto.nombre.trim(),
          email,
          passwordHash,
          rol: dto.rol,
          organizacionId: actor.orgId,
          passwordChangedAt: new Date(),
          sedes: {
            create: dto.sedeIds.map((sedeId) => ({ sedeId })),
          },
        },
        include: userInclude,
      });
      return toUserDto(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("El correo ya está registrado");
      }
      throw e;
    }
  }

  async update(actor: PanelUser, id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.usuario.findFirst({
      where: { id, organizacionId: actor.orgId },
      include: userInclude,
    });
    if (!existing) throw new NotFoundException();
    if (dto.activo === false && existing.id === actor.userId) {
      throw new ForbiddenException("No puedes desactivar tu propia cuenta");
    }
    if (dto.sedeIds) {
      await this.assertSedesInOrg(actor.orgId, dto.sedeIds);
    }
    const user = await this.prisma.usuario.update({
      where: { id },
      data: {
        ...(dto.rol ? { rol: dto.rol } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        ...(dto.disponible !== undefined ? { disponible: dto.disponible } : {}),
        ...(dto.sedeIds
          ? {
              sedes: {
                deleteMany: {},
                create: dto.sedeIds.map((sedeId) => ({ sedeId })),
              },
            }
          : {}),
      },
      include: userInclude,
    });
    if (dto.activo === false) {
      await this.auth.revokeAllRefresh(id);
    }
    return toUserDto(user);
  }

  async setCredentials(actor: PanelUser, id: string, dto: SetCredentialsDto) {
    const existing = await this.prisma.usuario.findFirst({
      where: { id, organizacionId: actor.orgId },
    });
    if (!existing) throw new NotFoundException();
    assertPasswordPolicy(dto.password, existing.email);
    const passwordHash = await hashPassword(dto.password);
    await this.prisma.usuario.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    await this.auth.revokeAllRefresh(id);
  }

  private async assertSedesInOrg(orgId: string, sedeIds: string[]) {
    const count = await this.prisma.sede.count({
      where: { organizacionId: orgId, id: { in: sedeIds } },
    });
    if (count !== sedeIds.length) {
      throw new ForbiddenException("Sede inválida para la organización");
    }
  }
}
