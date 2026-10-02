import { publicApiUrl } from "@/lib/api-url";

/** Reescribe URLs del guion al origen que usa el browser (p. ej. `/backend` en Railway). */
export function browserGuionAssetUrl(apiAbsoluteUrl: string): string {
  try {
    const parsed = new URL(apiAbsoluteUrl);
    if (!parsed.pathname.startsWith("/public/guion/")) {
      return apiAbsoluteUrl;
    }
    const path = parsed.pathname.replace(/\.svg$/i, ".jpg");
    const base = publicApiUrl();
    if (base.startsWith("/")) {
      return `${base}${path}`;
    }
    return `${base}${path}`;
  } catch {
    return apiAbsoluteUrl;
  }
}
