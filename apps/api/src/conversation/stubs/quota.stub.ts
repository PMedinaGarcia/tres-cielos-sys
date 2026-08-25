import { Injectable } from "@nestjs/common";

@Injectable()
export class QuotaStubService {
  private hardLimit = false;
  private messagingUnits = 0;
  private iaTokens = 0;

  setHardLimit(value: boolean): void {
    this.hardLimit = value;
  }

  isHardLimitIa(): boolean {
    return this.hardLimit;
  }

  consumeMessaging(units = 1): void {
    this.messagingUnits += units;
  }

  consumeIaTokens(tokens: number): void {
    this.iaTokens += tokens;
  }

  snapshot(): {
    unidadesMensajeria: number;
    tokensEstimados: number;
    usoAgenticRag: boolean;
  } {
    return {
      unidadesMensajeria: this.messagingUnits,
      tokensEstimados: this.iaTokens,
      usoAgenticRag: this.iaTokens > 0,
    };
  }

  reset(): void {
    this.hardLimit = false;
    this.messagingUnits = 0;
    this.iaTokens = 0;
  }
}
