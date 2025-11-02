import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerLocation } from './location.entity';
import { LocationService } from './location.service';
import { LocationController } from './location.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerLocation])],
  providers: [LocationService],
  controllers: [LocationController],
  exports: [LocationService],
})
export class LocationsModule {}
