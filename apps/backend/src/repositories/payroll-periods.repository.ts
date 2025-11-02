import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollPeriod } from '../modules/finance/payroll-period.entity';

@Injectable()
export class PayrollPeriodsRepository {
  constructor(@InjectRepository(PayrollPeriod) private repo: Repository<PayrollPeriod>) {}
  list() { return this.repo.find(); }
  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  save(entity: Partial<PayrollPeriod>) { return this.repo.save(entity); }
}

