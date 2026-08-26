import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import {
  ESTADO_ATENCION,
  COLA_CRM,
  ETAPA_COTIZACION,
  TIPO_EVENTO,
  VISITA_ESTADO,
  type EstadoAtencion,
  type ColaCrm,
  type EtapaCotizacion,
  type TipoEventoCrm,
  type VisitaEstado,
} from "@tres-cielos/shared";

export class ListClientesQueryDto {
  @IsOptional()
  @IsIn(ESTADO_ATENCION)
  estadoAtencion?: EstadoAtencion;

  @IsOptional()
  @IsString()
  asesorId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true" || value === "1")
  @IsBoolean()
  sinAsignar?: boolean;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(COLA_CRM)
  cola?: ColaCrm;

  @IsOptional()
  @IsIn(TIPO_EVENTO)
  tipoEvento?: TipoEventoCrm;

  @IsOptional()
  @IsIn(ETAPA_COTIZACION)
  etapaCotizacion?: EtapaCotizacion;

  @IsOptional()
  @IsIn(VISITA_ESTADO)
  visitaEstado?: VisitaEstado;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ActualizarClienteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsEmail()
  correo?: string | null;

  @IsOptional()
  @IsString()
  sedeInteresId?: string | null;

  @IsOptional()
  @IsBoolean()
  optOutMensajeria?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(2)
  idioma?: string;

  @IsOptional()
  @IsString()
  zonaHoraria?: string;
}

export class CrearNotaClienteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  cuerpo!: string;
}

export class ReemplazarTagsDto {
  @IsArray()
  @IsString({ each: true })
  tags!: string[];
}

export class TimelineQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class HistorialQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @IsString()
  tipo?: string;
}
