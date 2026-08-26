import { createHash, timingSafeEqual } from "crypto";
import { BadRequestException } from "@nestjs/common";
import {
  passwordOmitsEmail,
  passwordPolicySchema,
} from "@tres-cielos/shared";

export function assertPasswordPolicy(password: string, email: string): void {
  const parsed = passwordPolicySchema.safeParse(password);
  if (!parsed.success) {
    throw new BadRequestException(
      parsed.error.issues.map((i) => i.message).join(". "),
    );
  }
  if (!passwordOmitsEmail(password, email)) {
    throw new BadRequestException(
      "La contraseña no debe contener el correo",
    );
  }
}

export function jwtExpiresIn(
  raw: string,
): `${number}${"s" | "m" | "h" | "d"}` {
  return raw as `${number}${"s" | "m" | "h" | "d"}`;
}

export function durationToMs(raw: string): number {
  const match = /^(\d+)(s|m|h|d)$/i.exec(raw.trim());
  if (!match) {
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber * 1000;
    return 15 * 60 * 1000;
  }
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const mul =
    unit === "s"
      ? 1000
      : unit === "m"
        ? 60_000
        : unit === "h"
          ? 3_600_000
          : 86_400_000;
  return n * mul;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
