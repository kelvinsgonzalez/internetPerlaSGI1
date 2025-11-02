import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RealtimeModule } from "../../realtime/realtime.module";
import { Customer } from "../customers/customer.entity";
import { User } from "../users/user.entity";
import { Task } from "./task.entity";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [TypeOrmModule.forFeature([Task, User, Customer]), RealtimeModule],
  providers: [TasksService],
  controllers: [TasksController],
})
export class TasksModule {}
