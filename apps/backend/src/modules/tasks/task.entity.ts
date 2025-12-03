import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Customer } from "../customers/customer.entity";
import { User } from "../users/user.entity";
export type TaskStatus = "PENDIENTE" | "EN_PROCESO" | "COMPLETADA" | "OBJETADA";

@Entity()
export class Task {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() title: string;
  @Column("text", { nullable: true }) description: string;
  @ManyToOne(() => Customer, { eager: true, nullable: false })
  customer: Customer;
  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' }) assignedTo: User;
  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' }) createdBy: User;
  // Store status as a simple string for compatibility and easier evolution
  @Column({ type: "varchar", default: "PENDIENTE" }) status: TaskStatus;
  @Column({ type: "varchar", length: 50, nullable: false })
  telefonoContacto!: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @Column({ type: "text", nullable: true }) motivoObjecion?: string | null;
  @Column({ type: "text", nullable: true }) comentarioFinal?: string | null;
  @Column({ type: "timestamptz", nullable: true }) completedAt?: Date | null;
  @Column({ type: "text", nullable: true }) proofUrl?: string | null;
  @Column({ type: "boolean", default: false }) archived: boolean;
  @Column({ type: "timestamptz", nullable: true }) archivedAt?: Date | null;
}
