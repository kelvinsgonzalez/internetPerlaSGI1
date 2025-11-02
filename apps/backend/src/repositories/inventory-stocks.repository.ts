import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryStock } from '../modules/inventory/inventory-stock.entity';

@Injectable()
export class InventoryStocksRepository {
  constructor(@InjectRepository(InventoryStock) private repo: Repository<InventoryStock>) {}
  list() { return this.repo.find(); }
  findByItemAndWarehouse(itemId: string, warehouseId: string) {
    return this.repo.findOne({ where: { item: { id: itemId }, warehouse: { id: warehouseId } } });
  }
  save(entity: Partial<InventoryStock>) { return this.repo.save(entity); }
  deleteByItemId(itemId: string) {
    return this.repo
      .createQueryBuilder()
      .delete()
      .from(InventoryStock)
      .where('"itemId" = :itemId', { itemId })
      .execute();
  }
}

