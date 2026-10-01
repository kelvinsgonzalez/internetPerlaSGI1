import { Module } from "@nestjs/common";
import { HistorialController } from "./historial.controller";
import { HistorialDatabase } from "./historial.database";
import { HistorialService } from "./historial.service";

@Module({
  providers: [HistorialDatabase, HistorialService],
  controllers: [HistorialController],
})
export class HistorialModule {}
