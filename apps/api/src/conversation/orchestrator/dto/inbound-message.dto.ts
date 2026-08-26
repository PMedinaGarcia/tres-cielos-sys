import {
  IsArray,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class PerfilCanalDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  psid?: string;

  @IsOptional()
  @IsString()
  waId?: string;
}

class AdjuntoInboundDto {
  @IsString()
  mimeType!: string;

  @IsOptional()
  sizeBytes?: number;

  @IsOptional()
  duracionSec?: number;

  @IsOptional()
  @IsString()
  storageKey?: string;
}

export class InboundMessageDto {
  @IsString()
  canal!: string;

  @IsString()
  externalThreadId!: string;

  @IsString()
  externalMessageId!: string;

  @IsString()
  texto!: string;

  @IsOptional()
  @IsString()
  buttonPayload?: string;

  @IsISO8601()
  recibidoEn!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PerfilCanalDto)
  perfilCanal?: PerfilCanalDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdjuntoInboundDto)
  adjuntos?: AdjuntoInboundDto[];
}
