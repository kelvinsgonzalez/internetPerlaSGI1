import { Injectable } from "@nestjs/common";
import { PlansRepository } from "../../repositories/plans.repository";

@Injectable()
export class PlansService {
  constructor(private plans: PlansRepository) {}
  findAll() {
    return this.plans.findAll();
  }
}
