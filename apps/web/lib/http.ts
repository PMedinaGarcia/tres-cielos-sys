export { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth-cookies";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3011";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let redirectingToLogin = false;

function goLogin() {
  if (typeof window === "undefined" || redirectingToLogin) return;
  redirectingToLogin = true;
  const next = `${window.location.pathname}${window.location.search}`;
  const qs =
    next && next !== "/login" ? `?next=${encodeURIComponent(next)}` : "";
  window.location.assign(`/login${qs}`);
}

const NETWORK_ERROR =
  "No se pudo conectar con el API. Comprueba que esté en marcha.";

async function request(
  path: string,
  init: RequestInit,
  headers: Headers,
): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  opts: { retryOn401?: boolean } = {},
): Promise<Response> {
  const retryOn401 = opts.retryOn401 ?? true;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await request(path, init, headers);
  if (res.status !== 401) return res;
  const isAuthPath = path.startsWith("/auth/");
  if (!retryOn401 || isAuthPath) {
    if (!isAuthPath) goLogin();
    return res;
  }
  let refreshed: Response;
  try {
    refreshed = await request("/auth/refresh", { method: "POST" }, new Headers());
  } catch {
    goLogin();
    return res;
  }
  if (!refreshed.ok) {
    goLogin();
    return res;
  }
  return request(path, init, headers);
}

export async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(res.status, text || `HTTP ${res.status}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}
