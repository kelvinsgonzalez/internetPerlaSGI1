import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { AttendanceType } from "../../common/enums";

export class CheckDto {
  @IsString() name: string;
  @IsEnum(AttendanceType) tipo: AttendanceType;
  @IsOptional() @IsString() note?: string;
}

export class CreateAttendanceDto {
  @IsString()
  userId: string;

  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsInt()
  @Min(0)
  completedTasks: number;

  @IsInt()
  @Min(0)
  totalTasks: number;
}
