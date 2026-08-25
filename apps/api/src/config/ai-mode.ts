import type { ConfigService } from "@nestjs/config";

export function isLiveAiProviders(config?: ConfigService | null): boolean {
  if (!config) return false;
  return (config.get<string>("ai.providersMode") ?? "fake") === "live";
}
