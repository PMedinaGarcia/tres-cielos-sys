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
 * Twilio request signature — NUNCA AuthGuard JWT.
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const authToken =
      this.config.get<string>("TWILIO_AUTH_TOKEN") ||
      process.env.TWILIO_AUTH_TOKEN ||
      "";

    if (!authToken) {
      if (process.env.APP_ENV === "prod") {
        throw new UnauthorizedException("TWILIO_AUTH_TOKEN_REQUIRED");
      }
      if (req.header("x-dev-bypass-signature") === "1") return true;
    }

    const signature =
      req.header("x-twilio-signature") ||
      req.header("X-Twilio-Signature") ||
      "";
    if (!signature) {
      throw new UnauthorizedException("INVALID_TWILIO_SIGNATURE");
    }
    if (!authToken) {
      throw new UnauthorizedException("TWILIO_AUTH_TOKEN_REQUIRED");
    }

    const url = resolvePublicUrl(req);
    const params = flattenParams(req.body);
    if (!verifyTwilioSignature(url, params, signature, authToken)) {
      throw new UnauthorizedException("INVALID_TWILIO_SIGNATURE");
    }
    return true;
  }
}

export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string,
): boolean {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function resolvePublicUrl(req: Request): string {
  const configured = process.env.TWILIO_WEBHOOK_URL;
  if (configured) return configured;
  const proto = (req.header("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  const host = req.header("x-forwarded-host") || req.get("host") || "localhost";
  return `${proto}://${host}${req.originalUrl || req.url}`;
}

function flattenParams(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}
