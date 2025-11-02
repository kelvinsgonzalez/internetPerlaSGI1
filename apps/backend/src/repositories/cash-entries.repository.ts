import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CashEntry } from "../modules/finance/cash-entry.entity";

@Injectable()
export class CashEntriesRepository {
  constructor(
    @InjectRepository(CashEntry) private repo: Repository<CashEntry>
  ) {}

  listByDate(entryDate: string, createdById?: string) {
    const where: any = { entryDate };
    if (createdById) where.createdById = createdById;
    return this.repo.find({ where, order: { createdAt: "ASC" } });
  }

  // Aggregate totals per date within range, optionally filtered by user
  async aggregateByDateRange(from: string, to: string, createdById?: string) {
    const qb = this.repo
      .createQueryBuilder("e")
      .select("e.entryDate", "date")
      .addSelect(
        "SUM(CASE WHEN e.type = 'INCOME' THEN e.amount ELSE 0 END)",
        "incomes"
      )
      .addSelect(
        "SUM(CASE WHEN e.type = 'EXPENSE' THEN e.amount ELSE 0 END)",
        "expenses"
      )
      .where("e.entryDate BETWEEN :from AND :to", { from, to })
      .groupBy("e.entryDate")
      .orderBy("e.entryDate", "DESC");
    if (createdById)
      qb.andWhere("e.createdById = :createdById", { createdById });
    const rows = await qb.getRawMany<{
      date: string;
      incomes: string;
      expenses: string;
    }>();
    return rows.map((r) => ({
      date: r.date,
      incomes: parseFloat(r.incomes || "0"),
      expenses: parseFloat(r.expenses || "0"),
      balance: parseFloat(r.incomes || "0") - parseFloat(r.expenses || "0"),
    }));
  }

  save(entity: Partial<CashEntry>) {
    return this.repo.save(entity);
  }
}
