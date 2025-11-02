import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Customer } from "./customer.entity";

@Entity()
@Unique(["name"])
export class InternetPlan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0 })
  price: string;

  @Column({ nullable: true })
  speed?: string;

  @OneToMany(() => Customer, (c) => c.plan)
  customers: Customer[];
}
