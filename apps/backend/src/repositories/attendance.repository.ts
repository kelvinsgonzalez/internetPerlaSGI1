import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AttendanceRecord } from "../modules/attendance/attendance-record.entity";

@Injectable()
export class AttendanceRepository {
  constructor(
    @InjectRepository(AttendanceRecord)
    private repo: Repository<AttendanceRecord>
  ) {}
  list() {
    return this.repo.find({ order: { timestamp: "DESC" } });
  }
  save(entity: Partial<AttendanceRecord>) {
    return this.repo.save(entity);
  }

  findByName(name: string) { return this.repo.find({ where: { name } }); }

  async hasInForToday(name: string) {
    const count = await this.repo
      .createQueryBuilder("a")
      .where("a.name = :name", { name })
      .andWhere("DATE(a.timestamp) = CURRENT_DATE")
      .andWhere("a.tipo = :tipo", { tipo: "IN" })
      .getCount();
    return count > 0;
  }

  latestForName(name: string) {
    return this.repo.findOne({ where: { name }, order: { timestamp: "DESC" } });
  }

  async todayCount(name: string, tipo: "IN" | "OUT") {
    const count = await this.repo
      .createQueryBuilder("a")
      .where("a.name = :name", { name })
      .andWhere("DATE(a.timestamp) = CURRENT_DATE")
      .andWhere("a.tipo = :tipo", { tipo })
      .getCount();
    return count;
  }
}
