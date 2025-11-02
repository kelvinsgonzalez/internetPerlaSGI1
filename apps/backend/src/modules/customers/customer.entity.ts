import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
export class Customer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Nombre completo del cliente (antes 'name')
  @Column()
  name: string;

  // Teléfono principal
  @Column({ nullable: true })
  phone?: string;

  // Dirección física
  @Column({ nullable: true })
  address?: string;

  // Dirección IP asignada
  @Column({ name: "ip_asignada", length: 50, nullable: true })
  ipAsignada?: string;

  // Latitud (sin límite de caracteres, acepta string o vacío)
  @Column({ type: "varchar", nullable: true })
  latitud?: string | null;

  // Longitud (sin límite de caracteres, acepta string o vacío)
  @Column({ type: "varchar", nullable: true })
  longitud?: string | null;

  // Relación opcional con plan de Internet
  @ManyToOne(
    () => require("./internet-plan.entity").InternetPlan,
    (plan: any) => plan.customers,
    { nullable: true }
  )
  plan?: any;

  // Estado del cliente (activo, suspendido, moroso, etc.)
  @Column({ default: "active" })
  status: string;

  // Notas adicionales
  @Column({ type: "text", nullable: true })
  notes?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
