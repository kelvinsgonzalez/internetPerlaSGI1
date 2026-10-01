import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RealtimeModule } from "../../realtime/realtime.module";
import { User } from "../users/user.entity";
import { AppRelease } from "./app-release.entity";
import { ReleasesController } from "./releases.controller";
import { ReleasesService } from "./releases.service";

@Module({
  imports: [TypeOrmModule.forFeature([AppRelease, User]), RealtimeModule],
  providers: [ReleasesService],
  controllers: [ReleasesController],
})
export class ReleasesModule {}
