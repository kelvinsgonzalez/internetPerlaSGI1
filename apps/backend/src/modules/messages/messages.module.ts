import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './message.entity';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { User } from '../users/user.entity';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, User]),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get('JWT_SECRET'),
      }),
    }),
  ],
  providers: [MessagesService, RealtimeGateway],
  controllers: [MessagesController],
})
export class MessagesModule {}
