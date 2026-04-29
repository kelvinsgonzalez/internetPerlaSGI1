import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { Customer } from "../modules/customers/customer.entity";

@Injectable()
export class CustomersRepository {
  constructor(@InjectRepository(Customer) private repo: Repository<Customer>) {}
  findAll() {
    return this.repo.find({ relations: ["plan"] });
  }
  findById(id: string) {
    return this.repo.findOne({ where: { id }, relations: ["plan"] });
  }
  findByNameAndAddress(name: string, address?: string | null) {
    const addr = address?.trim();
    if (!addr) {
      return this.repo.findOne({
        where: [
          { name, address: "" },
          { name, address: IsNull() },
        ],
      });
    }
    return this.repo.findOne({ where: { name, address: addr } });
  }
  save(entity: Partial<Customer>) {
    return this.repo.save(entity);
  }
  remove(entity: Customer) {
    return this.repo.remove(entity);
  }
  async removeAll(): Promise<{ tasks: number; customers: number }> {
    return this.repo.manager.transaction(async (m) => {
      const tasksRes = await m
        .createQueryBuilder()
        .delete()
        .from("task")
        .execute();
      const custRes = await m
        .createQueryBuilder()
        .delete()
        .from(Customer)
        .execute();
      return {
        tasks: tasksRes.affected ?? 0,
        customers: custRes.affected ?? 0,
      };
    });
  }
}
