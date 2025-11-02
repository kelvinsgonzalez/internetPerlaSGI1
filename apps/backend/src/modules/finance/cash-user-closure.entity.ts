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
export class CashUserClosure {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "date" }) date: string; // YYYY-MM-DD
  @Index() @Column({ type: "uuid" }) userId: string;
  @CreateDateColumn() closedAt: Date;
}
