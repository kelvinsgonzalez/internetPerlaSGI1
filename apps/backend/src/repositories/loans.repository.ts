import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Loan } from '../modules/finance/loan.entity';

@Injectable()
export class LoansRepository {
  constructor(@InjectRepository(Loan) private repo: Repository<Loan>) {}
  list() { return this.repo.find(); }
  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  save(entity: Partial<Loan>) { return this.repo.save(entity); }
}

