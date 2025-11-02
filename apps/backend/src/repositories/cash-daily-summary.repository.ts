import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";
import { CashDailySummary } from "../modules/finance/cash-daily-summary.entity";

@Injectable()
export class CashDailySummaryRepository {
  constructor(
    @InjectRepository(CashDailySummary)
    private repo: Repository<CashDailySummary>
  ) {}

  upsertForDate(date: string, data: Partial<CashDailySummary>) {
    return this.repo
      .upsert({ date, ...data }, ["date"]) // conflict target is unique 'date'
      .then(() => this.findByDate(date));
  }

  findByDate(date: string) {
    return this.repo.findOne({ where: { date } });
  }

  listByDateRange(from: string, to: string) {
    return this.repo.find({
      where: { date: Between(from, to) },
      order: { date: "DESC" },
    });
  }
}
