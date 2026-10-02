import { ConfigService } from "@nestjs/config";

export function flowConfig(
  flow: "v1" | "v2" | "v3" | "v4",
  extras?: { canaryPct?: number; fieldTestReset?: boolean },
): ConfigService {
  return {
    get: (key: string) => {
      if (key === "conversation.flow") return flow;
      if (key === "conversation.canaryPct") return extras?.canaryPct;
      if (key === "conversation.fieldTestReset") return extras?.fieldTestReset;
      return undefined;
    },
  } as ConfigService;
}
