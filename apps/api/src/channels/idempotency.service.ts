import { Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { mapCanalCrm } from "../crm/cliente-identity";

/**
 * F2 — dedupe por (canal, externalMessageId).
 * Stub in-memory; Fase A debe persistir UNIQUE(canal, external_message_id).
 */
@Injectable()
export class IdempotencyService {
  private readonly seen = new Set<string>();

  constructor(@Optional() private readonly prisma?: PrismaService) {}

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

  release(canal: string, externalMessageId: string): void {
    this.seen.delete(this.key(canal, externalMessageId));
  }

  /**
   * true si el mensaje ya está en Postgres.
   * false si hay base y no está.
   * null si no se puede comprobar.
   */
  async isDurable(
    canal: string,
    externalMessageId: string,
  ): Promise<boolean | null> {
    if (!externalMessageId || !this.prisma || !process.env.DATABASE_URL) {
      return null;
    }
    try {
      const row = await this.prisma.mensaje.findFirst({
        where: {
          canal: mapCanalCrm(canal),
          externalMessageId,
        },
        select: { id: true },
      });
      return Boolean(row);
    } catch {
      return null;
    }
  }

  /** Tests */
  clear(): void {
    this.seen.clear();
  }
}
