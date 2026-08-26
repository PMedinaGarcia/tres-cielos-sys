import type { ConfigService } from "@nestjs/config";

export function isLiveAiProviders(config?: ConfigService | null): boolean {
  if (!config) return false;
  return (config.get<string>("ai.providersMode") ?? "fake") === "live";
}

export type RagStore = "memory" | "prisma";

export function resolveRagStore(config?: ConfigService | null): RagStore {
  if (!config) return "memory";
  const explicit = config.get<string>("rag.store");
  if (explicit === "memory" || explicit === "prisma") return explicit;
  return isLiveAiProviders(config) ? "prisma" : "memory";
}

export function isObjectStorageLive(config?: ConfigService | null): boolean {
  if (!config) return false;
  const provider = config.get<string>("storage.provider") ?? "memory";
  return provider === "s3" || provider === "r2";
}
