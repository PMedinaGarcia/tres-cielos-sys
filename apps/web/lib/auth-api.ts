import type { LoginResponse, SedeDto, UserDto } from "@tres-cielos/shared";
import { apiFetch, readJson } from "./http";

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await apiFetch(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    { retryOn401: false },
  );
  return readJson<LoginResponse>(res);
}

export async function listUsers(): Promise<UserDto[]> {
  const res = await apiFetch("/usuarios");
  const json = await readJson<{ data: UserDto[] }>(res);
  return json.data;
}

export async function createUser(input: {
  nombre: string;
  email: string;
  password: string;
  rol: UserDto["rol"];
  sedeIds: string[];
}): Promise<UserDto> {
  const res = await apiFetch("/usuarios", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json = await readJson<{ data: UserDto }>(res);
  return json.data;
}

export async function patchUser(
  id: string,
  patch: Partial<Pick<UserDto, "activo" | "disponible" | "rol" | "sedeIds">>,
): Promise<UserDto> {
  const res = await apiFetch(`/usuarios/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const json = await readJson<{ data: UserDto }>(res);
  return json.data;
}

export async function setCredentials(
  id: string,
  password: string,
): Promise<void> {
  const res = await apiFetch(`/usuarios/${id}/credenciales`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  await readJson(res);
}

export async function listSedes(): Promise<SedeDto[]> {
  const res = await apiFetch("/sedes");
  const json = await readJson<{ data: SedeDto[] }>(res);
  return json.data;
}
