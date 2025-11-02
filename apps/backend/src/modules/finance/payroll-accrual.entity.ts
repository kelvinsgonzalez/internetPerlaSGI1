import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity()
@Unique(["date", "userId"])
export class PayrollAccrual {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "date" }) date: string; // YYYY-MM-DD
  @Index() @Column({ type: "uuid" }) userId: string;
  @Column({ nullable: true }) userName?: string;
  @Column("decimal", { precision: 12, scale: 2 }) amount: number;
  @Column({ default: "Sueldo diario" }) description: string;
  @Index() @Column({ type: "uuid", nullable: true }) cashClosureId?: string; // CashDailySummary.id
  @CreateDateColumn() createdAt: Date;
}
