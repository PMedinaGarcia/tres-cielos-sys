/** Destino del panel cuando Inicio, Catálogo y Chat sandbox están apagados. */
export const OPERATIONAL_HOME = "/crm";

const DEV_ONLY_PREFIXES = ["/catalogo", "/sandbox"] as const;

/**
 * Esas tres rutas son herramientas de desarrollo.
 * En el panel desplegado (`NEXT_PUBLIC_APP_ENV=staging|production|prod`) no se muestran.
 * Local, sin la variable o con `development` / `dev`, siguen disponibles.
 */
export function devRoutesEnabled(): boolean {
  const env = (process.env.NEXT_PUBLIC_APP_ENV ?? "").trim().toLowerCase();
  return env === "" || env === "development" || env === "dev";
}

export function isDevOnlyPath(pathname: string): boolean {
  const path = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  if (path === "/") return true;
  return DEV_ONLY_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function panelHomePath(): string {
  return devRoutesEnabled() ? "/" : OPERATIONAL_HOME;
}
