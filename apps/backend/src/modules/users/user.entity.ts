import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";
import { decimalTransformer } from "../../common/decimal.transformer";

export enum Role {
  ADMIN = "ADMIN",
  SUPERVISOR = "SUPERVISOR",
  USER = "USER",
}

/**
 * Roles con acceso a los módulos de gestión (Asistencia, Finanzas, Tareas,
 * Mapa y Mensajes). La administración de usuarios, clientes e inventario
 * sigue siendo exclusiva de ADMIN.
 */
export const MANAGEMENT_ROLES = [Role.ADMIN, Role.SUPERVISOR];
export const isManager = (role?: string) =>
  role === Role.ADMIN || role === Role.SUPERVISOR;

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

  // Último cambio de contraseña. `JwtStrategy` invalida los tokens emitidos
  // antes de esta fecha, para que un cambio de contraseña cierre de verdad las
  // sesiones abiertas con el token anterior.
  @Column({ type: 'timestamptz', nullable: true })
  passwordChangedAt?: Date | null;

  // Última vez que el usuario leyó las Novedades. Las versiones publicadas
  // después de esta fecha se le muestran como pendientes.
  @Column({ type: 'timestamptz', nullable: true })
  releasesSeenAt?: Date | null;
}
