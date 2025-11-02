import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternalDebt } from '../modules/finance/internal-debt.entity';

@Injectable()
export class DebtsRepository {
  constructor(@InjectRepository(InternalDebt) private repo: Repository<InternalDebt>) {}
  list() { return this.repo.find(); }
  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  save(entity: Partial<InternalDebt>) { return this.repo.save(entity); }
}

