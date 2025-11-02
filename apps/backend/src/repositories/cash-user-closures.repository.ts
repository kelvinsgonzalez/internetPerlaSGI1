import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";
import { CashUserClosure } from "../modules/finance/cash-user-closure.entity";

@Injectable()
export class CashUserClosuresRepository {
  constructor(
    @InjectRepository(CashUserClosure) private repo: Repository<CashUserClosure>
  ) {}

  async upsert(date: string, userId: string) {
    await this.repo.upsert({ date, userId }, ["date", "userId"]);
    return this.repo.findOne({ where: { date, userId } });
  }

  async exists(date: string, userId: string) {
    return (await this.repo.count({ where: { date, userId } })) > 0;
  }

  async deleteByDate(date: string) {
    return this.repo.delete({ date });
  }

  async listByDateRange(from: string, to: string) {
    return this.repo.find({ where: { date: Between(from, to) } });
  }
}
