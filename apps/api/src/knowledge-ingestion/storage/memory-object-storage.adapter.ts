import { createHash, randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";
import type {
  GetObjectResult,
  ObjectStoragePort,
  PutObjectRequest,
  PutObjectResult,
  SignedUrlRequest,
} from "../../ports/object-storage.port";

/**
 * Adapter memoria local (CI / tests unitarios sin Nest DI).
 * Preferir FakeObjectStoragePort de ports/__fakes__ cuando AiProviders está activo.
 */
@Injectable()
export class MemoryObjectStorageAdapter implements ObjectStoragePort {
  private readonly store = new Map<
    string,
    { body: Buffer; contentType: string }
  >();
  readonly bucket = "memory";

  async put(request: PutObjectRequest): Promise<PutObjectResult> {
    const key = request.key || `mem/${randomUUID()}`;
    const body =
      typeof request.body === "string"
        ? Buffer.from(request.body)
        : Buffer.from(request.body);
    this.store.set(key, { body, contentType: request.contentType });
    return {
      key,
      bucket: this.bucket,
      etag: createHash("sha256").update(body).digest("hex").slice(0, 16),
    };
  }

  async get(key: string): Promise<GetObjectResult> {
    const hit = this.store.get(key);
    if (!hit) throw new Error(`STORAGE_KEY_NOT_FOUND:${key}`);
    return { body: hit.body, contentType: hit.contentType };
  }

  async signedUrl(request: SignedUrlRequest): Promise<string> {
    if (!this.store.has(request.key)) {
      throw new Error(`STORAGE_KEY_NOT_FOUND:${request.key}`);
    }
    return `memory://signed/${encodeURIComponent(request.key)}?ttl=${request.expiresInSec ?? 300}`;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async ping(): Promise<boolean> {
    return true;
  }

  keys(): string[] {
    return [...this.store.keys()];
  }

  clear(): void {
    this.store.clear();
  }
}
