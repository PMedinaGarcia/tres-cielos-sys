import type { UserDto } from "@tres-cielos/shared";
import type { RolUsuario } from "@prisma/client";

type UserRow = {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  organizacionId: string;
  disponible: boolean;
  activo: boolean;
  sedes: { sedeId: string }[];
};

export function toUserDto(user: UserRow): UserDto {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    sedeIds: user.sedes.map((s) => s.sedeId),
    orgId: user.organizacionId,
    disponible: user.disponible,
    activo: user.activo,
  };
}
