import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";
import {
  ETAPA_PIPELINE,
  MOTIVO_PERDIDO,
  VISITA_ESTADO,
  type EtapaPipeline,
  type MotivoPerdido,
  type VisitaEstado,
} from "@tres-cielos/shared";

export class ActualizarOportunidadDto {
  @IsOptional()
  @IsIn(VISITA_ESTADO)
  visitaEstado?: VisitaEstado;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  visitaAgendadaEn?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(2000)
  visitaNotas?: string | null;

  @IsOptional()
  @IsBoolean()
  marcarPropuestaEnviada?: boolean;

  @IsOptional()
  @IsIn(ETAPA_PIPELINE)
  etapa?: EtapaPipeline;

  @IsOptional()
  @IsIn(MOTIVO_PERDIDO)
  motivoPerdido?: MotivoPerdido | null;
}
