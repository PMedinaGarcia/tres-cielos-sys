import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import {
  BANDEJA_ADJUNTO_MAX_BYTES,
  CompletarMultipartRequestSchema,
  PrepararAdjuntoBandejaRequestSchema,
  S3_SINGLE_PUT_MAX_BYTES,
  type CompletarAdjuntoBandejaResponse,
  type PrepararAdjuntoBandejaResponse,
} from "@tres-cielos/shared";
import type { PanelUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { OBJECT_STORAGE_PORT } from "../ports/tokens";
import type { ObjectStoragePort } from "../ports/object-storage.port";
import { STORAGE_PREFIXES } from "../ports/storage-prefixes";
import { mimePermitidoBandeja } from "./bandeja-media.util";

const UPLOAD_TTL_MS = 60 * 60 * 1000;
const MULTIPART_PART = 64 * 1024 * 1024;
const SIGNED_PUT_TTL_SEC = 60 * 60;

type UploadSession = {
  uploadId: string;
  conversacionId: string;
  clienteId: string;
  storageKey: string;
  mimeType: string;
  nombreOriginal: string;
  bytes: number;
  method: "put" | "multipart";
  uploadIdS3?: string;
  partCount?: number;
  usuarioId: string;
  expiresAt: number;
  completed: boolean;
};

@Injectable()
export class BandejaAttachmentsService {
  private readonly logger = new Logger(BandejaAttachmentsService.name);
  private readonly sessions = new Map<string, UploadSession>();
  private s3?: S3Client;
  private bucket?: string;

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() @Inject(OBJECT_STORAGE_PORT) private readonly storage?: ObjectStoragePort,
    @Optional() private readonly config?: ConfigService,
  ) {
    const provider = config?.get<string>("storage.provider") ?? "memory";
    const mode = config?.get<string>("ai.providersMode") ?? "fake";
    if (provider !== "memory" && mode !== "fake") {
      const region = config?.get<string>("storage.region") ?? "us-east-1";
      const endpoint = config?.get<string>("storage.endpoint")?.trim();
      this.bucket = config?.get<string>("storage.bucket") ?? "tres-cielos-dev";
      const accessKeyId = config?.get<string>("storage.accessKeyId")?.trim();
      const secretAccessKey = config?.get<string>("storage.secretAccessKey")?.trim();
      const credentials =
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined;
      this.s3 = new S3Client({
        region,
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
        ...(credentials ? { credentials } : {}),
      });
    }
  }

  async preparar(
    conversacionId: string,
    body: unknown,
    user: PanelUser,
  ): Promise<PrepararAdjuntoBandejaResponse> {
    const parsed = PrepararAdjuntoBandejaRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("ADJUNTO_INVALIDO");
    const dto = parsed.data;
    if (!mimePermitidoBandeja(dto.mimeType)) {
      throw new BadRequestException("MIME_NO_PERMITIDO");
    }
    const conv = await this.loadConversacion(conversacionId, user);
    const uploadId = randomUUID();
    const storageKey = `${STORAGE_PREFIXES.adjuntoCanal}/saliente/${conv.id}/${uploadId}/${sanitizeName(dto.nombreOriginal)}`;
    const expiresAt = Date.now() + UPLOAD_TTL_MS;
    const method =
      dto.bytes > S3_SINGLE_PUT_MAX_BYTES ? "multipart" : "put";

    const session: UploadSession = {
      uploadId,
      conversacionId: conv.id,
      clienteId: conv.clienteId,
      storageKey,
      mimeType: dto.mimeType,
      nombreOriginal: dto.nombreOriginal,
      bytes: dto.bytes,
      method,
      usuarioId: user.userId,
      expiresAt,
      completed: false,
    };

    if (method === "put") {
      if (!this.storage) throw new BadRequestException("STORAGE_NO_DISPONIBLE");
      let uploadUrl = await this.storage.signedUrl({
        key: storageKey,
        operation: "put",
        expiresInSec: SIGNED_PUT_TTL_SEC,
      });
      if (uploadUrl.startsWith("memory://")) {
        const base =
          this.config?.get<string>("publicApiUrl")?.replace(/\/$/, "") ?? "";
        const prefix = process.env.API_PREFIX?.trim() ?? "";
        const path = `${prefix}/conversaciones/${conv.id}/adjuntos/${uploadId}/binario`;
        uploadUrl = base ? `${base}${path}` : path;
      }
      this.sessions.set(uploadId, session);
      return {
        uploadId,
        storageKey,
        method: "put",
        uploadUrl,
        expiresEn: new Date(expiresAt).toISOString(),
      };
    }

    const multipart = await this.createMultipartSession(session);
    this.sessions.set(uploadId, session);
    return {
      uploadId,
      storageKey,
      method: "multipart",
      multipart,
      expiresEn: new Date(expiresAt).toISOString(),
    };
  }

  async completarPut(
    conversacionId: string,
    uploadId: string,
    user: PanelUser,
  ): Promise<CompletarAdjuntoBandejaResponse> {
    const session = this.requireSession(uploadId, conversacionId, user);
    if (session.method !== "put") {
      throw new BadRequestException("MULTIPART_REQUERIDO");
    }
    if (!this.storage) throw new BadRequestException("STORAGE_NO_DISPONIBLE");
    const ok = await this.storage.exists(session.storageKey);
    if (!ok) throw new BadRequestException("OBJETO_NO_SUBIDO");
    session.completed = true;
    return this.toCompletar(session);
  }

  async completarMultipart(
    conversacionId: string,
    uploadId: string,
    body: unknown,
    user: PanelUser,
  ): Promise<CompletarAdjuntoBandejaResponse> {
    const parsed = CompletarMultipartRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("PARTES_INVALIDAS");
    const session = this.requireSession(uploadId, conversacionId, user);
    if (session.method !== "multipart" || !session.uploadIdS3) {
      throw new BadRequestException("PUT_SIMPLE");
    }
    if (!this.s3 || !this.bucket) {
      throw new BadRequestException("STORAGE_NO_DISPONIBLE");
    }
    await this.s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: session.storageKey,
        UploadId: session.uploadIdS3,
        MultipartUpload: {
          Parts: parsed.data.parts.map((p) => ({
            PartNumber: p.partNumber,
            ETag: p.etag,
          })),
        },
      }),
    );
    session.completed = true;
    return this.toCompletar(session);
  }

  consumeForSend(
    conversacionId: string,
    uploadId: string,
    user: PanelUser,
  ): CompletarAdjuntoBandejaResponse {
    const session = this.requireSession(uploadId, conversacionId, user);
    if (!session.completed) {
      throw new BadRequestException("ADJUNTO_INCOMPLETO");
    }
    this.sessions.delete(uploadId);
    return this.toCompletar(session);
  }

  async escribirBinario(
    conversacionId: string,
    uploadId: string,
    body: Buffer,
    user: PanelUser,
  ): Promise<CompletarAdjuntoBandejaResponse> {
    const session = this.requireSession(uploadId, conversacionId, user);
    if (session.method !== "put") {
      throw new BadRequestException("MULTIPART_REQUERIDO");
    }
    if (!this.storage) throw new BadRequestException("STORAGE_NO_DISPONIBLE");
    if (body.length !== session.bytes) {
      throw new BadRequestException("TAMANO_NO_COINCIDE");
    }
    await this.storage.put({
      key: session.storageKey,
      body,
      contentType: session.mimeType,
    });
    session.completed = true;
    return this.toCompletar(session);
  }

  async publicUrl(storageKey: string, expiresInSec = 3600): Promise<string> {
    const publicBase = this.config?.get<string>("storage.publicBaseUrl")?.trim();
    if (publicBase) {
      return `${publicBase.replace(/\/$/, "")}/${storageKey}`;
    }
    if (!this.storage) {
      throw new BadRequestException("STORAGE_NO_DISPONIBLE");
    }
    return this.storage.signedUrl({
      key: storageKey,
      operation: "get",
      expiresInSec,
    });
  }

  private toCompletar(session: UploadSession): CompletarAdjuntoBandejaResponse {
    return {
      uploadId: session.uploadId,
      storageKey: session.storageKey,
      mimeType: session.mimeType,
      nombreOriginal: session.nombreOriginal,
      bytes: session.bytes,
    };
  }

  private requireSession(
    uploadId: string,
    conversacionId: string,
    user: PanelUser,
  ): UploadSession {
    this.purgeExpired();
    const session = this.sessions.get(uploadId);
    if (!session) throw new NotFoundException("UPLOAD_NO_ENCONTRADO");
    if (session.conversacionId !== conversacionId) {
      throw new ForbiddenException("UPLOAD_CONVERSACION");
    }
    if (session.usuarioId !== user.userId && user.role !== "admin") {
      throw new ForbiddenException("UPLOAD_USUARIO");
    }
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(uploadId);
      throw new BadRequestException("UPLOAD_EXPIRADO");
    }
    return session;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (s.expiresAt < now) this.sessions.delete(id);
    }
  }

  private async createMultipartSession(session: UploadSession) {
    if (!this.s3 || !this.bucket) {
      throw new BadRequestException("STORAGE_MULTIPART_NO_DISPONIBLE");
    }
    if (session.bytes > BANDEJA_ADJUNTO_MAX_BYTES) {
      throw new BadRequestException("ARCHIVO_DEMASIADO_GRANDE");
    }
    const created = await this.s3.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: session.storageKey,
        ContentType: session.mimeType,
      }),
    );
    if (!created.UploadId) {
      throw new BadRequestException("MULTIPART_INICIAR_FALLIDO");
    }
    session.uploadIdS3 = created.UploadId;
    const partCount = Math.ceil(session.bytes / MULTIPART_PART);
    session.partCount = partCount;
    const partUrls: string[] = [];
    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const url = await getSignedUrl(
        this.s3,
        new UploadPartCommand({
          Bucket: this.bucket,
          Key: session.storageKey,
          UploadId: created.UploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: SIGNED_PUT_TTL_SEC },
      );
      partUrls.push(url);
    }
    return {
      uploadIdS3: created.UploadId,
      partSize: MULTIPART_PART,
      partUrls,
    };
  }

  private async loadConversacion(conversacionId: string, user: PanelUser) {
    if (!this.prisma || !process.env.DATABASE_URL) {
      throw new BadRequestException("DB_NO_DISPONIBLE");
    }
    const conv = await this.prisma.conversacion.findFirst({
      where: {
        id: conversacionId,
        ...(user.role === "asesor"
          ? {
              cliente: {
                OR: [
                  { asesorAsignadoId: user.userId },
                  { asesorAsignadoId: null },
                ],
              },
            }
          : {}),
      },
      select: { id: true, clienteId: true },
    });
    if (!conv) throw new NotFoundException("CONVERSACION_NOT_FOUND");
    return conv;
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 200);
}
