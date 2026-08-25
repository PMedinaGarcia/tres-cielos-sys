import { createHmac, timingSafeEqual } from "crypto";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

/**
 * Meta X-Hub-Signature-256 — NUNCA AuthGuard JWT.
 * Header: sha256=<hex>
 */
@Injectable()
export class MetaSignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { rawBody?: Buffer }>();
    const secret =
      this.config.get<string>("META_APP_SECRET") ||
      process.env.META_APP_SECRET ||
      "";

    if (!secret) {
      if (process.env.APP_ENV === "prod") {
        throw new UnauthorizedException("META_APP_SECRET_REQUIRED");
      }
      const bypass = req.header("x-dev-bypass-signature");
      if (bypass === "1") return true;
    }

    const header =
      req.header("x-hub-signature-256") ||
      req.header("X-Hub-Signature-256") ||
      "";
    if (!header.startsWith("sha256=")) {
      throw new UnauthorizedException("INVALID_META_SIGNATURE");
    }

    const raw = getRawBody(req);
    if (!secret) {
      throw new UnauthorizedException("META_APP_SECRET_REQUIRED");
    }

    const expected =
      "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
    if (!timingSafeEqualString(header, expected)) {
      throw new UnauthorizedException("INVALID_META_SIGNATURE");
    }
    return true;
  }
}

export function verifyMetaSignature(
  rawBody: Buffer | string,
  signatureHeader: string,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=") || !appSecret) return false;
  const expected =
    "sha256=" +
    createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return timingSafeEqualString(signatureHeader, expected);
}

function getRawBody(
  req: Request & { rawBody?: Buffer; body?: unknown },
): Buffer {
  if (req.rawBody) return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  return Buffer.from(JSON.stringify(req.body ?? {}));
}

function timingSafeEqualString(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
