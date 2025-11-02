import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PublicUsersController } from './users.public.controller';
import { RealtimeModule } from '../../realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RealtimeModule],
  providers: [UsersService],
  controllers: [UsersController, PublicUsersController],
  exports: [UsersService],
})
export class UsersModule {}
