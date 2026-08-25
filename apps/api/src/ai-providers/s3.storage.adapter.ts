import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  GetObjectResult,
  ObjectStoragePort,
  PutObjectRequest,
  PutObjectResult,
  SignedUrlRequest,
} from "../ports/object-storage.port";
import { StorageError } from "../ports/errors";

@Injectable()
export class S3StorageAdapter implements ObjectStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>("storage.region") ?? "us-east-1";
    const endpoint = this.config.get<string>("storage.endpoint");
    this.bucket = this.config.get<string>("storage.bucket") ?? "tres-cielos-dev";
    this.client = new S3Client({
      region,
      ...(endpoint
        ? { endpoint, forcePathStyle: true }
        : {}),
      credentials: {
        accessKeyId: this.config.get<string>("storage.accessKeyId") ?? "",
        secretAccessKey: this.config.get<string>("storage.secretAccessKey") ?? "",
      },
    });
  }

  async put(request: PutObjectRequest): Promise<PutObjectResult> {
    try {
      const body =
        typeof request.body === "string"
          ? Buffer.from(request.body, "utf8")
          : Buffer.from(request.body);
      const result = await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: request.key,
          Body: body,
          ContentType: request.contentType,
          Metadata: request.metadata,
        }),
      );
      return { key: request.key, bucket: this.bucket, etag: result.ETag };
    } catch (err) {
      throw new StorageError(`S3 put failed: ${String(err)}`, "s3", err);
    }
  }

  async get(key: string): Promise<GetObjectResult> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) {
        throw new StorageError(`Empty body for key ${key}`, "s3");
      }
      return {
        body: Buffer.from(bytes),
        contentType: result.ContentType,
        metadata: result.Metadata,
      };
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(`S3 get failed: ${String(err)}`, "s3", err);
    }
  }

  async signedUrl(request: SignedUrlRequest): Promise<string> {
    try {
      const expiresIn = request.expiresInSec ?? 300;
      const command =
        request.operation === "put"
          ? new PutObjectCommand({ Bucket: this.bucket, Key: request.key })
          : new GetObjectCommand({ Bucket: this.bucket, Key: request.key });
      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (err) {
      throw new StorageError(`S3 signedUrl failed: ${String(err)}`, "s3", err);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      throw new StorageError(`S3 delete failed: ${String(err)}`, "s3", err);
    }
  }
}
