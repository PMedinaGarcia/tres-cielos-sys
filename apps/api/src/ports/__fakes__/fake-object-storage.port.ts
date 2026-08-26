import type {
  GetObjectResult,
  ObjectStoragePort,
  PutObjectRequest,
  PutObjectResult,
  SignedUrlRequest,
} from "../object-storage.port";
import { StorageError } from "../errors";

interface StoredObject {
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

/**
 * Fake object storage en memoria (CI sin S3/MinIO).
 */
export class FakeObjectStoragePort implements ObjectStoragePort {
  private readonly store = new Map<string, StoredObject>();
  readonly bucket: string;

  constructor(bucket = "fake-bucket") {
    this.bucket = bucket;
  }

  async put(request: PutObjectRequest): Promise<PutObjectResult> {
    const body =
      typeof request.body === "string"
        ? Buffer.from(request.body, "utf8")
        : Buffer.from(request.body);
    this.store.set(request.key, {
      body,
      contentType: request.contentType,
      metadata: request.metadata,
    });
    return { key: request.key, bucket: this.bucket, etag: `fake-${body.length}` };
  }

  async get(key: string): Promise<GetObjectResult> {
    const hit = this.store.get(key);
    if (!hit) {
      throw new StorageError(`Object not found: ${key}`, "fake-storage");
    }
    return {
      body: Buffer.from(hit.body),
      contentType: hit.contentType,
      metadata: hit.metadata,
    };
  }

  async signedUrl(request: SignedUrlRequest): Promise<string> {
    const expires = request.expiresInSec ?? 300;
    return `memory://${this.bucket}/${request.key}?op=${request.operation ?? "get"}&exp=${expires}`;
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

  /** Test helper */
  keys(): string[] {
    return [...this.store.keys()];
  }

  clear(): void {
    this.store.clear();
  }
}
