import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { PayrollAccrual } from "../modules/finance/payroll-accrual.entity";

@Injectable()
export class PayrollAccrualsRepository {
  constructor(
    @InjectRepository(PayrollAccrual) private repo: Repository<PayrollAccrual>
  ) {}

  async listByDate(date: string) {
    return this.repo.find({ where: { date } });
  }

  async exists(date: string, userId: string) {
    const c = await this.repo.count({ where: { date, userId } });
    return c > 0;
  }

  async upsertMany(accruals: Array<Partial<PayrollAccrual>>) {
    if (!accruals.length) return [];
    // rely on unique(date,userId)
    await this.repo.upsert(accruals, ["date", "userId"]);
    return this.repo.find({
      where: {
        date: accruals[0].date,
        userId: In(accruals.map((a) => a.userId!)),
      },
    });
  }

  async sumForDate(date: string) {
    const rows = await this.repo
      .createQueryBuilder("a")
      .select("COALESCE(SUM(a.amount),0)", "sum")
      .where("a.date = :date", { date })
      .getRawOne<{ sum: string }>();
    return parseFloat(rows?.sum || "0");
  }

  async summaryByDateRange(from: string, to: string) {
    const rows = await this.repo
      .createQueryBuilder("a")
      .select("a.userId", "userId")
      .addSelect("COALESCE(MIN(a.userName), '')", "name")
      .addSelect("COUNT(DISTINCT a.date)", "daysWorked")
      .addSelect("COALESCE(SUM(a.amount),0)", "totalDue")
      .where("a.date BETWEEN :from AND :to", { from, to })
      .groupBy("a.userId")
      .orderBy("name", "ASC")
      .getRawMany<{
        userId: string;
        name: string;
        daysWorked: string;
        totalDue: string;
      }>();
    return rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      days_worked: parseInt(r.daysWorked || "0", 10),
      total_due: parseFloat(r.totalDue || "0"),
    }));
  }

  async assignClosureId(date: string, userIds: string[], closureId: string) {
    if (!userIds.length) return { affected: 0 };
    return this.repo
      .createQueryBuilder()
      .update(PayrollAccrual)
      .set({ cashClosureId: closureId })
      .where("date = :date", { date })
      .andWhere("userId IN (:...userIds)", { userIds })
      .execute();
  }

  async deleteByDate(date: string) {
    return this.repo.delete({ date });
  }
}
