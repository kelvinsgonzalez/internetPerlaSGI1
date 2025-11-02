import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RealtimeModule } from "../../realtime/realtime.module";
import { AttendanceRecord } from "./attendance-record.entity";
import { AttendanceController } from "./attendance.controller";
import { Attendance } from "./attendance.entity";
import { AttendanceService } from "./attendance.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceRecord, Attendance]),
    RealtimeModule,
  ],
  providers: [AttendanceService],
  controllers: [AttendanceController],
})
export class AttendanceModule {}
