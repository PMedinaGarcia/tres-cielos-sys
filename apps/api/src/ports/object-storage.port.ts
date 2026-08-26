export interface PutObjectRequest {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface PutObjectResult {
  key: string;
  bucket: string;
  etag?: string;
}

export interface GetObjectResult {
  body: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface SignedUrlRequest {
  key: string;
  expiresInSec?: number;
  operation?: "get" | "put";
}

/**
 * Port object storage (S3-compatible). Binarios nunca en Postgres.
 * CI: FakeObjectStoragePort (memoria).
 */
export interface ObjectStoragePort {
  put(request: PutObjectRequest): Promise<PutObjectResult>;
  get(key: string): Promise<GetObjectResult>;
  signedUrl(request: SignedUrlRequest): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** HeadBucket / sanity check. Fake y FS siempre true si el backend responde. */
  ping(): Promise<boolean>;
}
