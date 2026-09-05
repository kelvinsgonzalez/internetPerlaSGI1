import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { AttendanceType } from "../../common/enums";

// La identidad (name / userId) sale siempre del JWT, nunca del body: si se
// aceptara del cliente, cualquier usuario podría marcar asistencia por otro.
export class CheckDto {
  @IsEnum(AttendanceType) tipo: AttendanceType;
  @IsOptional() @IsString() note?: string;
}

export class CreateAttendanceDto {
  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsInt()
  @Min(0)
  completedTasks: number;

  @IsInt()
  @Min(0)
  totalTasks: number;
}
