import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./guards/roles.guard";
import { ROLES_KEY } from "./decorators/roles.decorator";
import type { PanelUser } from "./auth.types";

function ctx(user?: PanelUser) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as never;
}

describe("RolesGuard", () => {
  it("403 si el rol no está permitido", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["admin"]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const asesor: PanelUser = {
      userId: "u",
      email: "a@x.co",
      name: "A",
      role: "asesor",
      sedeIds: [],
      orgId: "o",
      flags: { activo: true, disponible: true },
    };
    expect(() => guard.canActivate(ctx(asesor))).toThrow(ForbiddenException);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });

  it("permite admin", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["admin"]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const admin: PanelUser = {
      userId: "u",
      email: "a@x.co",
      name: "A",
      role: "admin",
      sedeIds: [],
      orgId: "o",
      flags: { activo: true, disponible: true },
    };
    expect(guard.canActivate(ctx(admin))).toBe(true);
  });
});
