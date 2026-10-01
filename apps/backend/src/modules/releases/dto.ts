import { ArrayUnique, IsArray, IsDateString, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { Role } from "../users/user.entity";

const ROLES = Object.values(Role);

export class CreateReleaseDto {
  @IsString()
  @Matches(/^v?\d+(\.\d+){0,3}([-+][\w.]+)?$/, { message: "Versión inválida (ej. 1.4.0)" })
  @MaxLength(32)
  version: string;

  @IsString() @MinLength(3) @MaxLength(160)
  title: string;

  @IsString() @MinLength(3) @MaxLength(10000)
  notes: string;

  @IsOptional() @IsArray() @ArrayUnique() @IsIn(ROLES, { each: true })
  audience?: Role[];

  @IsOptional() @IsDateString()
  publishedAt?: string;
}

export class UpdateReleaseDto {
  @IsOptional() @IsString()
  @Matches(/^v?\d+(\.\d+){0,3}([-+][\w.]+)?$/, { message: "Versión inválida (ej. 1.4.0)" })
  @MaxLength(32)
  version?: string;

  @IsOptional() @IsString() @MinLength(3) @MaxLength(160)
  title?: string;

  @IsOptional() @IsString() @MinLength(3) @MaxLength(10000)
  notes?: string;

  @IsOptional() @IsArray() @ArrayUnique() @IsIn(ROLES, { each: true })
  audience?: Role[];

  @IsOptional() @IsDateString()
  publishedAt?: string;
}
