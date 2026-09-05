import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

import { decimalTransformer } from "../../common/decimal.transformer";
@Entity()
@Unique(["date"])
export class CashDailySummary {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "date" }) date: string; // YYYY-MM-DD
  @Column("decimal", { precision: 12, scale: 2, default: 0, transformer: decimalTransformer }) incomes: number;
  @Column("decimal", { precision: 12, scale: 2, default: 0, transformer: decimalTransformer }) expenses: number;
  @Column("decimal", { precision: 12, scale: 2, default: 0, transformer: decimalTransformer }) balance: number;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: "varchar", length: 255, nullable: true })
  closedBy?: string; // email del admin
}
