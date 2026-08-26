import { createHash, randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { Injectable } from "@nestjs/common";
import type {
  GetObjectResult,
  ObjectStoragePort,
  PutObjectRequest,
  PutObjectResult,
  SignedUrlRequest,
} from "../../ports/object-storage.port";

/**
 * Adapter FS local (dev sin MinIO). OBJECT_STORAGE_FS_ROOT o ./data/object-storage
 */
@Injectable()
export class FsObjectStorageAdapter implements ObjectStoragePort {
  readonly bucket = "fs-local";

  private root(): string {
    return (
      process.env.OBJECT_STORAGE_FS_ROOT ||
      path.resolve(process.cwd(), "data/object-storage")
    );
  }

  private resolveKey(key: string): string {
    const safe = key.replace(/\\/g, "/").replace(/\.\./g, "");
    return path.join(this.root(), safe);
  }

  async put(request: PutObjectRequest): Promise<PutObjectResult> {
    const key = request.key || `fs/${randomUUID()}`;
    const body =
      typeof request.body === "string"
        ? Buffer.from(request.body)
        : Buffer.from(request.body);
    const full = this.resolveKey(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    await fs.writeFile(
      `${full}.meta.json`,
      JSON.stringify({ contentType: request.contentType }),
      "utf8",
    );
    return {
      key,
      bucket: this.bucket,
      etag: createHash("sha256").update(body).digest("hex").slice(0, 16),
    };
  }

  async get(key: string): Promise<GetObjectResult> {
    const body = await fs.readFile(this.resolveKey(key));
    return { body, contentType: "application/octet-stream" };
  }

  async signedUrl(request: SignedUrlRequest): Promise<string> {
    await fs.access(this.resolveKey(request.key));
    return `file://local/${encodeURIComponent(request.key)}?ttl=${request.expiresInSec ?? 300}`;
  }

  async delete(key: string): Promise<void> {
    const full = this.resolveKey(key);
    await fs.rm(full, { force: true });
    await fs.rm(`${full}.meta.json`, { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async ping(): Promise<boolean> {
    try {
      await fs.mkdir(this.root(), { recursive: true });
      return true;
    } catch {
      return false;
    }
  }
}
