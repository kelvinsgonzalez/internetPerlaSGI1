import { Module } from "@nestjs/common";
import { TaskArchiveController } from "./task-archive.controller";
import { TaskArchiveService } from "./task-archive.service";

@Module({
  providers: [TaskArchiveService],
  controllers: [TaskArchiveController],
  exports: [TaskArchiveService],
})
export class TaskArchiveModule {}
