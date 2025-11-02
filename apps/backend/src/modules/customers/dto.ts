import { Transform } from "class-transformer";
import { IsNumberString, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateCustomerDto {
  // nombreCompleto: accept legacy keys: name, nombre
  @Transform(
    ({ obj, value }) => value ?? obj.name ?? obj.nombre ?? obj.nombreCompleto
  )
  @IsString()
  nombreCompleto: string;

  // telefono: accept legacy key: phone
  @Transform(({ obj, value }) => value ?? obj.phone ?? obj.telefono)
  @IsOptional()
  @IsString()
  telefono?: string;

  // direccion: accept legacy key: address
  @Transform(({ obj, value }) => value ?? obj.address ?? obj.direccion)
  @IsOptional()
  @IsString()
  direccion?: string;

  // ipAsignada: accept legacy key: ip
  @Transform(({ obj, value }) => value ?? obj.ip ?? obj.ipAsignada)
  @IsOptional()
  @IsString()
  ipAsignada?: string;

  @Transform(({ value }) => value)
  @IsOptional()
  @IsNumberString()
  latitud?: string;

  @Transform(({ value }) => value)
  @IsOptional()
  @IsNumberString()
  longitud?: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  // planDeInternet: accept legacy key: planName
  @Transform(({ obj, value }) => value ?? obj.planName ?? obj.planDeInternet)
  @IsOptional()
  @IsString()
  planDeInternet?: string;

  // estadoCliente: accept legacy key: status/estado
  @Transform(
    ({ obj, value }) => value ?? obj.status ?? obj.estado ?? obj.estadoCliente
  )
  @IsOptional()
  @IsString()
  estadoCliente?: string;

  // notas: accept legacy key: notes
  @Transform(({ obj, value }) => value ?? obj.notes ?? obj.notas)
  @IsOptional()
  @IsString()
  notas?: string;
}

export class UpdateCustomerDto {
  @Transform(
    ({ obj, value }) => value ?? obj.name ?? obj.nombre ?? obj.nombreCompleto
  )
  @IsOptional()
  @IsString()
  nombreCompleto?: string;

  @Transform(({ obj, value }) => value ?? obj.phone ?? obj.telefono)
  @IsOptional()
  @IsString()
  telefono?: string;

  @Transform(({ obj, value }) => value ?? obj.address ?? obj.direccion)
  @IsOptional()
  @IsString()
  direccion?: string;

  @Transform(({ obj, value }) => value ?? obj.ip ?? obj.ipAsignada)
  @IsOptional()
  @IsString()
  ipAsignada?: string;

  @Transform(({ value }) => value)
  @IsOptional()
  @IsNumberString()
  latitud?: string;

  @Transform(({ value }) => value)
  @IsOptional()
  @IsNumberString()
  longitud?: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @Transform(({ obj, value }) => value ?? obj.planName ?? obj.planDeInternet)
  @IsOptional()
  @IsString()
  planDeInternet?: string;

  @Transform(
    ({ obj, value }) => value ?? obj.status ?? obj.estado ?? obj.estadoCliente
  )
  @IsOptional()
  @IsString()
  estadoCliente?: string;

  @Transform(({ obj, value }) => value ?? obj.notes ?? obj.notas)
  @IsOptional()
  @IsString()
  notas?: string;
}
