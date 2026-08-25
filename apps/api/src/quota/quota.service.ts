import { Injectable } from "@nestjs/common";

export interface QuotaSnapshot {
  sedeId: string;
  mensajeriaUsada: number;
  mensajeriaSoft: number;
  mensajeriaHard: number;
  tokensIaUsados: number;
  tokensIaSoft: number;
  tokensIaHard: number;
  softWarning: boolean;
  hardBlocked: boolean;
}

/**
 * F3 — cupo mensajería + IA soft/hard.
 * Hard → safe + handoff `cupo_ia`.
 */
@Injectable()
export class QuotaService {
  private readonly bySede = new Map<
    string,
    { msg: number; tokens: number }
  >();

  private limits() {
    return {
      mensajeriaSoft: Number(process.env.QUOTA_MSG_SOFT ?? 800),
      mensajeriaHard: Number(process.env.QUOTA_MSG_HARD ?? 1000),
      tokensIaSoft: Number(process.env.QUOTA_AI_TOKENS_SOFT ?? 200_000),
      tokensIaHard: Number(process.env.QUOTA_AI_TOKENS_HARD ?? 250_000),
    };
  }

  private bucket(sedeId: string) {
    let b = this.bySede.get(sedeId);
    if (!b) {
      b = { msg: 0, tokens: 0 };
      this.bySede.set(sedeId, b);
    }
    return b;
  }

  snapshot(sedeId: string): QuotaSnapshot {
    const lim = this.limits();
    const b = this.bucket(sedeId);
    const softWarning =
      b.msg >= lim.mensajeriaSoft || b.tokens >= lim.tokensIaSoft;
    const hardBlocked =
      b.msg >= lim.mensajeriaHard || b.tokens >= lim.tokensIaHard;
    return {
      sedeId,
      mensajeriaUsada: b.msg,
      mensajeriaSoft: lim.mensajeriaSoft,
      mensajeriaHard: lim.mensajeriaHard,
      tokensIaUsados: b.tokens,
      tokensIaSoft: lim.tokensIaSoft,
      tokensIaHard: lim.tokensIaHard,
      softWarning,
      hardBlocked,
    };
  }

  consumeMessaging(sedeId: string, units = 1): QuotaSnapshot {
    const before = this.snapshot(sedeId);
    if (before.hardBlocked) return before;
    this.bucket(sedeId).msg += units;
    return this.snapshot(sedeId);
  }

  checkAi(sedeId: string): QuotaSnapshot {
    return this.snapshot(sedeId);
  }

  consumeAiTokens(sedeId: string, tokens: number): QuotaSnapshot {
    const before = this.snapshot(sedeId);
    if (before.hardBlocked) return before;
    this.bucket(sedeId).tokens += tokens;
    return this.snapshot(sedeId);
  }

  /** Tests */
  setUsage(sedeId: string, msg: number, tokens: number): void {
    this.bySede.set(sedeId, { msg, tokens });
  }

  clear(): void {
    this.bySede.clear();
  }
}
