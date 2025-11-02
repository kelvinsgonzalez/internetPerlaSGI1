import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryMovement } from '../modules/inventory/inventory-movement.entity';

@Injectable()
export class InventoryMovementsRepository {
  constructor(@InjectRepository(InventoryMovement) private repo: Repository<InventoryMovement>) {}
  list() { return this.repo.find({ order: { timestamp: 'DESC' } }); }
  save(entity: Partial<InventoryMovement>) { return this.repo.save(entity); }
  deleteByItemId(itemId: string) {
    return this.repo
      .createQueryBuilder()
      .delete()
      .from(InventoryMovement)
      .where('"itemId" = :itemId', { itemId })
      .execute();
  }
}

