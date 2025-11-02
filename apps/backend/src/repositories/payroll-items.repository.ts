import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollItem } from '../modules/finance/payroll-item.entity';

@Injectable()
export class PayrollItemsRepository {
  constructor(@InjectRepository(PayrollItem) private repo: Repository<PayrollItem>) {}
  list() { return this.repo.find(); }
  save(entity: Partial<PayrollItem>) { return this.repo.save(entity); }
}

