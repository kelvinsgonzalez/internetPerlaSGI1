import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from './inventory-item.entity';
import { Warehouse } from './warehouse.entity';
import { InventoryStock } from './inventory-stock.entity';
import { InventoryMovement } from './inventory-movement.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem, Warehouse, InventoryStock, InventoryMovement])],
  providers: [InventoryService],
  controllers: [InventoryController],
})
export class InventoryModule {}

