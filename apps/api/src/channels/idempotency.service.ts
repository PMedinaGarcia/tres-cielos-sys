import { Injectable } from "@nestjs/common";

/**
 * F2 — dedupe por (canal, externalMessageId).
 * Stub in-memory; Fase A debe persistir UNIQUE(canal, external_message_id).
 */
@Injectable()
export class IdempotencyService {
  private readonly seen = new Set<string>();

  key(canal: string, externalMessageId: string): string {
    return `${canal}::${externalMessageId}`;
  }

  /**
   * @returns true si el mensaje es NUEVO (debe procesarse)
   */
  tryClaim(canal: string, externalMessageId: string): boolean {
    if (!externalMessageId) return false;
    const k = this.key(canal, externalMessageId);
    if (this.seen.has(k)) return false;
    this.seen.add(k);
    return true;
  }

  has(canal: string, externalMessageId: string): boolean {
    return this.seen.has(this.key(canal, externalMessageId));
  }

  /** Tests */
  clear(): void {
    this.seen.clear();
  }
}
