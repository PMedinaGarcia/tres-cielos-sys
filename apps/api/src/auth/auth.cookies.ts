import type { CookieOptions, Response } from "express";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth.constants";

export function cookieBase(opts: {
  secure: boolean;
  domain?: string;
  maxAgeMs: number;
}): CookieOptions {
  return {
    httpOnly: true,
    secure: opts.secure,
    sameSite: "lax",
    path: "/",
    maxAge: opts.maxAgeMs,
    ...(opts.domain ? { domain: opts.domain } : {}),
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { access: string; refresh: string },
  opts: {
    secure: boolean;
    domain?: string;
    accessMaxAgeMs: number;
    refreshMaxAgeMs: number;
  },
) {
  res.cookie(
    ACCESS_COOKIE,
    tokens.access,
    cookieBase({ ...opts, maxAgeMs: opts.accessMaxAgeMs }),
  );
  res.cookie(
    REFRESH_COOKIE,
    tokens.refresh,
    cookieBase({ ...opts, maxAgeMs: opts.refreshMaxAgeMs }),
  );
}

export function clearAuthCookies(
  res: Response,
  opts: { secure: boolean; domain?: string },
) {
  const base = {
    httpOnly: true,
    secure: opts.secure,
    sameSite: "lax" as const,
    path: "/",
    ...(opts.domain ? { domain: opts.domain } : {}),
  };
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}
