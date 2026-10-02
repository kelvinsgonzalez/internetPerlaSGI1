import { Module } from "@nestjs/common";
import { RealtimeModule } from "../../realtime/realtime.module";
import { SuspensionesController } from "./suspensiones.controller";
import { SuspensionesDatabase } from "./suspensiones.database";
import { SuspensionesLogService } from "./suspensiones-log.service";
import { SuspensionesService } from "./suspensiones.service";

@Module({
  imports: [RealtimeModule],
  providers: [SuspensionesDatabase, SuspensionesLogService, SuspensionesService],
  controllers: [SuspensionesController],
})
export class SuspensionesModule {}
