import { IsEnum, IsOptional, IsString } from "class-validator";

export class CreateTaskDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsString() customerId: string;
  @IsString() assignedToId: string;
  @IsString() telefonoContacto: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional()
  @IsEnum(["PENDIENTE", "EN_PROCESO", "COMPLETADA", "OBJETADA"] as const)
  status?: "PENDIENTE" | "EN_PROCESO" | "COMPLETADA" | "OBJETADA";
  @IsOptional() @IsString() motivoObjecion?: string;
  @IsOptional() @IsString() comentarioFinal?: string;
  @IsOptional() @IsString() telefonoContacto?: string;
}
