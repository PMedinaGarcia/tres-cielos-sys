/**
 * Errores tipificados de proveedores IA / storage.
 * El dominio mapea estos a safe + handoff (`proveedor_ia`), nunca inventa respuestas.
 */

export type ProviderErrorCode =
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_RATE_LIMIT"
  | "INVALID_MEDIA"
  | "STORAGE_ERROR"
  | "DIMENSION_MISMATCH";

export abstract class ProviderError extends Error {
  abstract readonly code: ProviderErrorCode;
  readonly provider: string;
  readonly cause?: unknown;

  constructor(message: string, provider: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.provider = provider;
    this.cause = cause;
  }
}

export class ProviderTimeoutError extends ProviderError {
  readonly code = "PROVIDER_TIMEOUT" as const;
}

export class ProviderUnavailableError extends ProviderError {
  readonly code = "PROVIDER_UNAVAILABLE" as const;
}

export class ProviderRateLimitError extends ProviderError {
  readonly code = "PROVIDER_RATE_LIMIT" as const;
}

export class InvalidMediaError extends ProviderError {
  readonly code = "INVALID_MEDIA" as const;
}

export class StorageError extends ProviderError {
  readonly code = "STORAGE_ERROR" as const;
}

export class DimensionMismatchError extends ProviderError {
  readonly code = "DIMENSION_MISMATCH" as const;
}

export function isProviderError(err: unknown): err is ProviderError {
  return err instanceof ProviderError;
}
