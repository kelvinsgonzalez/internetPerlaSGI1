import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("attendances")
export class Attendance {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column({ type: "date" })
  date: string; // YYYY-MM-DD

  @Column({ default: 0 })
  completedTasks: number;

  @Column({ default: 0 })
  totalTasks: number;

  @CreateDateColumn()
  createdAt: Date;
}
