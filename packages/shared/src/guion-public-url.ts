/** Base URL pública de la API para adjuntos del guion (PDF, cards). */
export function publicApiBaseUrlForGuion(): string {
  const fromEnv = process.env.PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const port = process.env.PORT ?? "3011";
  return `http://localhost:${port}`;
}
