import { Inject, Injectable, Optional } from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { OBJECT_STORAGE_PORT } from "../ports/tokens";
import type { ObjectStoragePort } from "../ports/object-storage.port";
import { ConfigService } from "@nestjs/config";
import { isObjectStorageLive } from "../config/ai-mode";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() @Inject(OBJECT_STORAGE_PORT)
    private readonly storage?: ObjectStoragePort,
  ) {}

  async checkReady() {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { ok: true };
    } catch (e) {
      checks.database = {
        ok: false,
        detail: e instanceof Error ? e.message : "db error",
      };
    }

    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
      });
      try {
        await redis.connect();
        const pong = await redis.ping();
        checks.redis = { ok: pong === "PONG" };
      } catch (e) {
        checks.redis = {
          ok: false,
          detail: e instanceof Error ? e.message : "redis error",
        };
      } finally {
        redis.disconnect();
      }
    } else {
      checks.redis = { ok: true, detail: "skipped" };
    }

    if (isObjectStorageLive(this.config) && this.storage) {
      try {
        checks.storage = { ok: await this.storage.ping() };
      } catch (e) {
        checks.storage = {
          ok: false,
          detail: e instanceof Error ? e.message : "s3 error",
        };
      }
    } else {
      checks.storage = { ok: true, detail: "memory" };
    }

    const ready = Object.values(checks).every((c) => c.ok);
    return { ready, status: ready ? "ok" : "degraded", checks };
  }
}
