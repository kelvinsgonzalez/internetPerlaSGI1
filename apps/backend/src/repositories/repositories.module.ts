import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AttendanceRecord } from "../modules/attendance/attendance-record.entity";
import { CustomerConflict } from "../modules/customers/customer-conflict.entity";
import { Customer } from "../modules/customers/customer.entity";
import { InternetPlan } from "../modules/customers/internet-plan.entity";
import { CashDailySummary } from "../modules/finance/cash-daily-summary.entity";
import { CashEntry } from "../modules/finance/cash-entry.entity";
import { CashUserClosure } from "../modules/finance/cash-user-closure.entity";
import { InternalDebt } from "../modules/finance/internal-debt.entity";
import { Loan } from "../modules/finance/loan.entity";
import { PayrollAccrual } from "../modules/finance/payroll-accrual.entity";
import { PayrollItem } from "../modules/finance/payroll-item.entity";
import { PayrollPeriod } from "../modules/finance/payroll-period.entity";
import { InventoryItem } from "../modules/inventory/inventory-item.entity";
import { InventoryMovement } from "../modules/inventory/inventory-movement.entity";
import { InventoryStock } from "../modules/inventory/inventory-stock.entity";
import { Warehouse } from "../modules/inventory/warehouse.entity";
import { User } from "../modules/users/user.entity";
import { AttendanceRepository } from "./attendance.repository";
import { CashDailySummaryRepository } from "./cash-daily-summary.repository";
import { CashEntriesRepository } from "./cash-entries.repository";
import { CashUserClosuresRepository } from "./cash-user-closures.repository";
import { CustomerConflictsRepository } from "./customer-conflicts.repository";
import { CustomersRepository } from "./customers.repository";
import { DebtsRepository } from "./debts.repository";
import { InventoryItemsRepository } from "./inventory-items.repository";
import { InventoryMovementsRepository } from "./inventory-movements.repository";
import { InventoryStocksRepository } from "./inventory-stocks.repository";
import { LoansRepository } from "./loans.repository";
import { PayrollAccrualsRepository } from "./payroll-accruals.repository";
import { PayrollItemsRepository } from "./payroll-items.repository";
import { PayrollPeriodsRepository } from "./payroll-periods.repository";
import { PlansRepository } from "./plans.repository";
import { UsersRepository } from "./users.repository";
import { WarehousesRepository } from "./warehouses.repository";

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Customer,
      InternetPlan,
      CustomerConflict,
      AttendanceRecord,
      InventoryItem,
      Warehouse,
      InventoryStock,
      InventoryMovement,
      PayrollPeriod,
      PayrollItem,
      PayrollAccrual,
      Loan,
      InternalDebt,
      CashEntry,
      CashUserClosure,
      CashDailySummary,
    ]),
  ],
  providers: [
    UsersRepository,
    CustomersRepository,
    AttendanceRepository,
    InventoryItemsRepository,
    WarehousesRepository,
    InventoryStocksRepository,
    InventoryMovementsRepository,
    PayrollPeriodsRepository,
    PayrollItemsRepository,
    LoansRepository,
    DebtsRepository,
    CashEntriesRepository,
    CashUserClosuresRepository,
    CashDailySummaryRepository,
    PayrollAccrualsRepository,
    PlansRepository,
    CustomerConflictsRepository,
  ],
  exports: [
    UsersRepository,
    CustomersRepository,
    AttendanceRepository,
    InventoryItemsRepository,
    WarehousesRepository,
    InventoryStocksRepository,
    InventoryMovementsRepository,
    PayrollPeriodsRepository,
    PayrollItemsRepository,
    LoansRepository,
    DebtsRepository,
    CashEntriesRepository,
    CashUserClosuresRepository,
    CashDailySummaryRepository,
    PayrollAccrualsRepository,
    PlansRepository,
    CustomerConflictsRepository,
  ],
})
export class RepositoriesModule {}
