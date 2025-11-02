import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from '../modules/inventory/warehouse.entity';

@Injectable()
export class WarehousesRepository {
  constructor(@InjectRepository(Warehouse) private repo: Repository<Warehouse>) {}
  list() { return this.repo.find(); }
  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  save(entity: Partial<Warehouse>) { return this.repo.save(entity); }
}

