import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { PayrollItemType, PayrollPeriodStatus } from "../../common/enums";
import { CashEntryType } from "./cash-entry.entity";

export class CreatePeriodDto {
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}

export class UpdatePeriodStatusDto {
  @IsEnum(PayrollPeriodStatus) status: PayrollPeriodStatus;
}

export class CreatePayrollItemDto {
  @IsString() periodId: string;
  @IsEnum(PayrollItemType) type: PayrollItemType;
  @IsNumber() amount: number;
  @IsString() employeeName: string;
}

export class CreateLoanDto {
  @IsString() employeeName: string;
  @IsNumber() total: number;
  @IsNumber() installments: number;
}
export class UpdateLoanBalanceDto {
  @IsNumber() balance: number;
}

export class CreateDebtDto {
  @IsString() employeeName: string;
  @IsString() description: string;
  @IsNumber() amount: number;
}
export class UpdateDebtBalanceDto {
  @IsOptional() @IsNumber() balance?: number;
}

export class CreateCashEntryDto {
  @IsDateString() entryDate: string; // YYYY-MM-DD
  @IsIn(["INCOME", "EXPENSE"]) type: CashEntryType;
  @IsString() description: string;
  @IsNumber() @Min(0.01) amount: number;
}

export class CashCutQueryDto {
  @IsDateString() date: string;
  @IsOptional() @IsString() userId?: string; // opcional, solo válido para ADMIN
}

export class DateRangeDto {
  @IsDateString() from: string;
  @IsDateString() to: string;
  @IsOptional() @IsString() userId?: string; // opcional, solo válido para ADMIN
}

export class CloseDayDto {
  @IsDateString() date: string;
  @IsOptional() @IsArray() @IsString({ each: true }) includeUserIds?: string[]; // ADMIN: usuarios a incluir en sueldos
}

export class DailySalaryCandidateDto {
  @IsDateString() date: string;
}

export class UserCloseDayDto {
  @IsDateString() date: string;
}

export class ReopenDayDto {
  @IsDateString() date: string;
}
