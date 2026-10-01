import { ArrayMaxSize, Equals, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

const MAX = 500;

/** Todos los campos son texto libre: se guardan tal cual. */
export class UpdateCobroDto {
  @IsOptional() @IsString() @MaxLength(MAX) extId?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(MAX) cliente?: string;
  @IsOptional() @IsString() @MaxLength(MAX) ubicacion?: string;
  @IsOptional() @IsString() @MaxLength(MAX) concepto?: string;
  @IsOptional() @IsString() @MaxLength(MAX) fecha?: string;
  @IsOptional() @IsString() @MaxLength(MAX) mesesCancelados?: string;
  @IsOptional() @IsString() @MaxLength(MAX) cantidadMeses?: string;
  @IsOptional() @IsString() @MaxLength(MAX) total?: string;
  @IsOptional() @IsString() @MaxLength(MAX) formaPago?: string;
  @IsOptional() @IsString() @MaxLength(MAX) cobrador?: string;
  @IsOptional() @IsString() @MaxLength(MAX) codigo?: string;
}

export class CreateCobroDto extends UpdateCobroDto {
  @IsString() @IsNotEmpty() @MaxLength(MAX) cliente: string;
}

export class ImportCobrosDto {
  // Filas crudas del archivo; el servicio normaliza encabezados y valores.
  @IsArray() @ArrayMaxSize(50000) registros: Record<string, unknown>[];
  @IsOptional() @IsBoolean() preview?: boolean;
  @IsOptional() @IsArray() @IsInt({ each: true }) omitir?: number[];
}

/** Frase que debe enviarse tal cual para vaciar el historial completo. */
export const FRASE_BORRAR_TODO = "BORRAR TODO";

export class BorrarTodoDto {
  // Segunda barrera en el servidor: un DELETE accidental (o un clic sin pasar
  // por las dos confirmaciones de la pantalla) no vacía la base.
  @IsString()
  @Equals(FRASE_BORRAR_TODO, { message: `Escribe exactamente "${FRASE_BORRAR_TODO}" para confirmar` })
  confirmacion: string;
}
