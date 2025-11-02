import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItem } from '../modules/inventory/inventory-item.entity';

@Injectable()
export class InventoryItemsRepository {
  constructor(@InjectRepository(InventoryItem) private repo: Repository<InventoryItem>) {}
  list() { return this.repo.find(); }
  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  save(entity: Partial<InventoryItem>) { return this.repo.save(entity); }
  remove(entity: InventoryItem) { return this.repo.remove(entity); }
}

