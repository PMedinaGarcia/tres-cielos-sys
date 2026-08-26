import type { RolUsuario } from "@tres-cielos/shared";

export type PanelUser = {
  userId: string;
  email: string;
  name: string;
  role: RolUsuario;
  sedeIds: string[];
  orgId: string;
  flags: { activo: boolean; disponible: boolean };
};

export type AccessJwtPayload = {
  sub: string;
  email: string;
  name: string;
  role: RolUsuario;
  sedeIds: string[];
  orgId: string;
  flags: { activo: boolean; disponible: boolean };
  sid: string;
  typ: "access";
  iat?: number;
  exp?: number;
};

export type RefreshJwtPayload = {
  sub: string;
  jti: string;
  typ: "refresh";
};
