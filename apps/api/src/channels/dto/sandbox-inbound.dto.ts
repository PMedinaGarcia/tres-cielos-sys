import {
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

export class SandboxInboundDto {
  @IsString()
  texto!: string;

  @IsOptional()
  @IsString()
  buttonPayload?: string;

  @IsOptional()
  @IsString()
  canal?: string;

  @IsOptional()
  @IsString()
  externalThreadId?: string;

  @IsOptional()
  @IsString()
  threadId?: string;

  @IsOptional()
  @IsString()
  externalMessageId?: string;

  @IsOptional()
  @IsISO8601()
  recibidoEn?: string;

  @IsOptional()
  @IsObject()
  perfilCanal?: { nombre?: string | null; waId?: string | null };

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
