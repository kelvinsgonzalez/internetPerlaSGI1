import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CustomerConflict } from "../modules/customers/customer-conflict.entity";

@Injectable()
export class CustomerConflictsRepository {
  constructor(
    @InjectRepository(CustomerConflict)
    private repo: Repository<CustomerConflict>
  ) {}

  findAll() {
    return this.repo.find({ order: { createdAt: "DESC" } });
  }
  save(entity: Partial<CustomerConflict>) {
    return this.repo.save(entity);
  }
}
