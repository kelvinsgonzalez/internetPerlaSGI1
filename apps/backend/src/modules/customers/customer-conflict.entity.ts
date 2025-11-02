import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity()
export class CustomerConflict {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  ipAsignada?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column("decimal", { precision: 10, scale: 6, nullable: true })
  latitud?: string | null;

  @Column("decimal", { precision: 10, scale: 6, nullable: true })
  longitud?: string | null;

  @Column({ nullable: true })
  planName?: string;

  @Column({ type: "text", nullable: true })
  reason?: string;

  @Column({ type: "jsonb", nullable: true })
  rowData?: any;

  @CreateDateColumn()
  createdAt: Date;
}
