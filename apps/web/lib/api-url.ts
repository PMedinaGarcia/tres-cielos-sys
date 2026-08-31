const LOCAL_API = "http://localhost:3011";

function stripSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * Base URL que usa el browser (`fetch` + cookies).
 * En Railway es same-origin (`/backend`); en local, el API en :3011.
 */
export function publicApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  return raw ? stripSlash(raw) : LOCAL_API;
}

/**
 * Origen absoluto para RSC y el proxy `/backend`.
 * En Railway: `API_INTERNAL_URL` (red privada). En local: URL absoluta del API.
 */
export function internalApiUrl(): string {
  const internal = process.env.API_INTERNAL_URL?.trim();
  if (internal) return stripSlash(internal);
  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (pub && /^https?:\/\//i.test(pub)) return stripSlash(pub);
  return LOCAL_API;
}
