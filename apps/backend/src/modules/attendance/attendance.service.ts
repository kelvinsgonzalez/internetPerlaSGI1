import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AttendanceType } from "../../common/enums";
import { RealtimeGateway } from "../../realtime/realtime.gateway";
import { AttendanceRepository } from "../../repositories/attendance.repository";
import { AttendanceRecord } from "./attendance-record.entity";
import { Attendance } from "./attendance.entity";
import { CheckDto, CreateAttendanceDto } from "./dto";

@Injectable()
export class AttendanceService {
  constructor(
    private repo: AttendanceRepository,
    private rt: RealtimeGateway,
    @InjectRepository(Attendance)
    private dailyRepo: Repository<Attendance>
  ) {}
  list() {
    return this.repo.list();
  }
  async check(dto: CheckDto) {
    const saved = await this.repo.save(dto as Partial<AttendanceRecord>);
    this.rt.broadcastToAdmins("attendance:created", saved);
    return saved;
  }

  async summary(name: string) {
    const [hasIn, latest, todayIn, todayOut] = await Promise.all([
      this.repo.hasInForToday(name),
      this.repo.latestForName(name),
      this.repo.todayCount(name, AttendanceType.IN),
      this.repo.todayCount(name, AttendanceType.OUT),
    ]);
    return {
      name,
      hasInForToday: hasIn,
      latest,
      today: { in: todayIn, out: todayOut },
    };
  }

  async register(dto: CreateAttendanceDto) {
    // Evitar duplicados por usuario/fecha
    const { userId, date } = dto;
    const existing = await this.dailyRepo.findOne({ where: { userId, date } });
    if (existing) return existing;
    const entity = this.dailyRepo.create(dto);
    return this.dailyRepo.save(entity);
  }
}
