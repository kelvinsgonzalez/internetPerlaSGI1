import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  ESTADOS_SUSPENSION,
  EstadoSuspension,
  RESULTADOS_ASIGNACION,
  ResultadoAsignacion,
  TIPOS_AGENDA,
  TIPOS_ASIGNACION,
  TipoAgenda,
  TipoAsignacion,
} from "./suspension.model";

const SHORT = 300;
const LONG = 5000;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA_MSG = { message: "La fecha debe tener el formato AAAA-MM-DD" };
const HORA_MSG = { message: "La hora debe tener el formato HH:mm" };

/** Recorta antes de validar: "   " no debe pasar como texto obligatorio. */
const Trim = () => Transform(({ value }) => (typeof value === "string" ? value.trim() : value));

export class FechaAcuerdoDto {
  @Matches(FECHA, FECHA_MSG) fecha: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) monto?: number | null;
  @IsOptional() @IsString() @MaxLength(SHORT) nota?: string | null;
}

export class CreateSuspensionDto {
  @Trim() @IsString() @IsNotEmpty({ message: "El nombre del cliente es obligatorio" }) @MaxLength(SHORT) clienteNombre: string;
  @IsOptional() @IsString() @MaxLength(SHORT) clienteTelefono?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) clienteDireccion?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) clienteIp?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) clientePlan?: string;
  @IsOptional() @IsString() @MaxLength(50) clienteLatitud?: string;
  @IsOptional() @IsString() @MaxLength(50) clienteLongitud?: string;
  @IsOptional() @IsString() @MaxLength(100) clienteOrigenId?: string;

  @Matches(FECHA, FECHA_MSG) fechaSuspension: string;
  @Type(() => Number) @IsNumber({}, { message: "El monto adeudado debe ser un número" }) @Min(0) montoAdeudado: number;
  /** Si no viene, se redacta con la plantilla. */
  @IsOptional() @IsString() @MaxLength(LONG) anuncio?: string;
}

export class UpdateSuspensionDto {
  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(SHORT) clienteNombre?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) clienteTelefono?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) clienteDireccion?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) clienteIp?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) clientePlan?: string;
  @IsOptional() @IsString() @MaxLength(50) clienteLatitud?: string;
  @IsOptional() @IsString() @MaxLength(50) clienteLongitud?: string;
  @IsOptional() @Matches(FECHA, FECHA_MSG) fechaSuspension?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) montoAdeudado?: number;
  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(LONG) anuncio?: string;
}

export class CambiarEstadoDto {
  @IsIn(ESTADOS_SUSPENSION as unknown as string[], { message: "Estado no válido" }) estado: EstadoSuspension;
  /** Comentario general del cambio (queda en la línea de tiempo). */
  @IsOptional() @IsString() @MaxLength(LONG) nota?: string;

  // REACTIVADO_ACUERDO
  @IsOptional() @IsString() @MaxLength(LONG) acuerdoTexto?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => FechaAcuerdoDto)
  acuerdoFechas?: FechaAcuerdoDto[];
  @IsOptional() @IsBoolean() enviarAgenda?: boolean;

  // RECOGER_EQUIPO
  @IsOptional() @IsString() @MaxLength(LONG) recogerNota?: string;
  @IsOptional() @Matches(FECHA, FECHA_MSG) recogerFecha?: string;

  // DESCONEXION
  @IsOptional() @IsString() @MaxLength(LONG) desconexionNota?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) montoPendienteFinal?: number;
}

export class CrearAsignacionDto {
  @IsIn(TIPOS_ASIGNACION as unknown as string[], { message: "Tipo no válido (RECOGER_EQUIPO o VISITA)" })
  tipo: TipoAsignacion;
  @IsOptional() @IsString() @MaxLength(LONG) instrucciones?: string;
  @IsOptional() @IsString() @MaxLength(50) telefonoContacto?: string;
  @IsOptional() @Matches(FECHA, FECHA_MSG) fechaProgramada?: string;
  @IsUUID("all", { message: "Selecciona un trabajador" }) trabajadorId: string;
}

export class CompletarAsignacionDto {
  @IsIn(RESULTADOS_ASIGNACION as unknown as string[], { message: "Selecciona el resultado" })
  resultado: ResultadoAsignacion;
  @Trim() @IsString() @IsNotEmpty({ message: "Escribe qué fue lo que pasó" }) @MaxLength(LONG) informe: string;
}

export class AgendaEntradaDto {
  @Matches(FECHA, FECHA_MSG) fecha: string;
  @IsOptional() @Matches(HORA, HORA_MSG) hora?: string;
  @IsIn(TIPOS_AGENDA as unknown as string[]) tipo: TipoAgenda;
  @IsOptional() @IsString() @MaxLength(SHORT) titulo?: string;
  @IsOptional() @IsString() @MaxLength(LONG) nota?: string;
  @IsOptional() @IsUUID() responsableId?: string;
}

export class CrearAgendaDto extends AgendaEntradaDto {
  @IsOptional() @IsUUID() suspensionId?: string;
}

export class EditarAgendaDto {
  @IsOptional() @Matches(FECHA, FECHA_MSG) fecha?: string;
  @IsOptional() @IsString() @MaxLength(5) hora?: string; // "" la quita
  @IsOptional() @IsIn(TIPOS_AGENDA as unknown as string[]) tipo?: TipoAgenda;
  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(SHORT) titulo?: string;
  @IsOptional() @IsString() @MaxLength(LONG) nota?: string;
  @IsOptional() @IsString() @MaxLength(100) responsableId?: string; // "" lo quita
}

export class ResolverAgendaDto {
  @IsIn(["HECHO", "CANCELADO", "PENDIENTE"]) estado: "HECHO" | "CANCELADO" | "PENDIENTE";
  @IsOptional() @IsString() @MaxLength(LONG) nota?: string;
}

export class ReasignarDto {
  @IsIn(TIPOS_ASIGNACION as unknown as string[]) tipo: TipoAsignacion;
  @IsOptional() @IsString() @MaxLength(LONG) instrucciones?: string;
  @IsOptional() @IsString() @MaxLength(50) telefonoContacto?: string;
  @IsOptional() @Matches(FECHA, FECHA_MSG) fechaProgramada?: string;
  @IsUUID("all", { message: "Selecciona un trabajador" }) trabajadorId: string;
}

export class RevisarAsignacionDto {
  @Trim() @IsString() @IsNotEmpty({ message: "Escribe la nota de revisión" }) @MaxLength(LONG) revisionNota: string;
  @IsOptional() @ValidateNested() @Type(() => CambiarEstadoDto) cambiarEstado?: CambiarEstadoDto;
  @IsOptional() @ValidateNested() @Type(() => AgendaEntradaDto) agenda?: AgendaEntradaDto;
  @IsOptional() @ValidateNested() @Type(() => ReasignarDto) reasignar?: ReasignarDto;
}

export class EliminarSuspensionDto {
  @Trim() @IsString() @IsNotEmpty({ message: "Escribe el motivo de la eliminación" }) @MaxLength(LONG) motivo: string;
}

export class EliminarAgendaDto {
  @IsOptional() @Trim() @IsString() @MaxLength(LONG) motivo?: string;
}

export interface ListarQuery {
  estado?: string;
  q?: string;
  desde?: string;
  hasta?: string;
  page?: string;
  vista?: string; // "activas" | "todas"
}

export interface AgendaQuery {
  desde?: string;
  hasta?: string;
  estado?: string;
  tipo?: string;
  responsableId?: string;
  suspensionId?: string;
}
