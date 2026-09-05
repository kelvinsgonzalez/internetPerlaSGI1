import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";
import { decimalTransformer } from "../../common/decimal.transformer";

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

  // `select: false` para que el hash no viaje en ninguna respuesta del API.
  // El login lo pide explícitamente en UsersRepository.findByEmail.
  @Column({ name: "password_hash", select: false })
  passwordHash: string;

  @Column({ type: "enum", enum: Role, default: Role.USER })
  role: Role;

  @Column({ nullable: true })
  name?: string;

  // Sueldo diario del empleado (Q), opcional
  @Column('decimal', {
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  dailySalary?: number | null;

  @Column('decimal', {
    precision: 10,
    scale: 6,
    nullable: true,
    name: 'latitude',
    transformer: decimalTransformer,
  })
  latitude?: number;

  @Column('decimal', {
    precision: 10,
    scale: 6,
    nullable: true,
    name: 'longitude',
    transformer: decimalTransformer,
  })
  longitude?: number;

  // Momento del último reporte de ubicación. Permite saber si un colaborador
  // sigue activo en lugar de inventarlo en el cliente.
  @Column({ type: 'timestamptz', nullable: true })
  locationUpdatedAt?: Date | null;

  @Column({ type: 'boolean', default: false })
  isBlocked: boolean;
}
