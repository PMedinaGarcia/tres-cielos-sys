import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { ROL_USUARIO, type RolUsuario } from "@tres-cielos/shared";

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  nombre!: string;

  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsIn(ROL_USUARIO)
  rol!: RolUsuario;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  sedeIds!: string[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsIn(ROL_USUARIO)
  rol?: RolUsuario;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsBoolean()
  disponible?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sedeIds?: string[];
}

export class SetCredentialsDto {
  @IsString()
  password!: string;
}
