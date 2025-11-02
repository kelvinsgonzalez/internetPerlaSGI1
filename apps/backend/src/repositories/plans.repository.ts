import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InternetPlan } from "../modules/customers/internet-plan.entity";

@Injectable()
export class PlansRepository {
  constructor(
    @InjectRepository(InternetPlan) private repo: Repository<InternetPlan>
  ) {}

  findAll() {
    return this.repo.find();
  }
  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }
  findByName(name: string) {
    return this.repo.findOne({ where: { name } });
  }
  save(entity: Partial<InternetPlan>) {
    return this.repo.save(entity);
  }
}
