import { z } from "zod";

export const ROL_USUARIO = ["asesor", "coordinador", "admin"] as const;
export type RolUsuario = (typeof ROL_USUARIO)[number];
export const RolUsuarioSchema = z.enum(ROL_USUARIO);

export const passwordPolicySchema = z
  .string()
  .min(12, "Mínimo 12 caracteres")
  .regex(/[a-z]/, "Requiere una minúscula")
  .regex(/[A-Z]/, "Requiere una mayúscula")
  .regex(/[0-9]/, "Requiere un dígito");

export function passwordOmitsEmail(password: string, email: string): boolean {
  const local = email.split("@")[0] ?? "";
  if (local.length < 3) return true;
  return !password.toLowerCase().includes(local.toLowerCase());
}

export const UserDtoSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  email: z.string().email(),
  rol: RolUsuarioSchema,
  sedeIds: z.array(z.string()),
  orgId: z.string(),
  disponible: z.boolean(),
  activo: z.boolean(),
});
export type UserDto = z.infer<typeof UserDtoSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  user: UserDtoSchema,
  expiresIn: z.number().int().positive(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const SedeDtoSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  activa: z.boolean(),
});
export type SedeDto = z.infer<typeof SedeDtoSchema>;
