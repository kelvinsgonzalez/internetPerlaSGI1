import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

export enum Role {
  ADMIN = "ADMIN",
  USER = "USER",
}

@Entity()
@Unique(["email"])
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  email: string;

  @Column({ name: "password_hash" })
  passwordHash: string;

  @Column({ type: "enum", enum: Role, default: Role.USER })
  role: Role;

  @Column({ nullable: true })
  name?: string;

  // Sueldo diario del empleado (Q), opcional
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  dailySalary?: number | null;

  @Column('decimal', {
    precision: 10,
    scale: 6,
    nullable: true,
    name: 'latitude',
  })
  latitude?: number;

  @Column('decimal', {
    precision: 10,
    scale: 6,
    nullable: true,
    name: 'longitude',
  })
  longitude?: number;

  @Column({ type: 'boolean', default: false })
  isBlocked: boolean;
}
