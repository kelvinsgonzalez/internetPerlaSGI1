import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RealtimeModule } from "../../realtime/realtime.module";
import { AutoCloseService } from "./auto-close.service";
import { CashEntry } from "./cash-entry.entity";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";
import { InternalDebt } from "./internal-debt.entity";
import { Loan } from "./loan.entity";
import { PayrollAccrual } from "./payroll-accrual.entity";
import { PayrollItem } from "./payroll-item.entity";
import { PayrollPeriod } from "./payroll-period.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PayrollPeriod,
      PayrollItem,
      Loan,
      InternalDebt,
      CashEntry,
      PayrollAccrual,
    ]),
    RealtimeModule,
  ],
  providers: [FinanceService, AutoCloseService],
  controllers: [FinanceController],
})
export class FinanceModule {}
