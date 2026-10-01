import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * Bitácora de auditoría: una fila por cada acción que cambia datos (crear,
 * editar, eliminar) y por cada intento de inicio de sesión.
 *
 * El nombre, correo y rol del autor se copian en la fila en lugar de guardarse
 * sólo como relación: así el registro sigue siendo legible aunque el usuario se
 * borre o cambie de nombre después.
 */
@Entity("audit_log")
@Index(["createdAt"])
@Index(["userId"])
@Index(["module"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @Column({ type: "uuid", nullable: true })
  userId?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  userEmail?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  userName?: string | null;

  @Column({ type: "varchar", length: 32, nullable: true })
  userRole?: string | null;

  /** CREAR, ACTUALIZAR, ELIMINAR, LOGIN, LOGIN_FALLIDO. */
  @Column({ type: "varchar", length: 32 })
  action: string;

  /** Primer segmento de la ruta del API (users, tasks, finance...). */
  @Column({ type: "varchar", length: 64 })
  module: string;

  @Column({ type: "varchar", length: 8 })
  method: string;

  @Column({ type: "varchar", length: 512 })
  path: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  entityId?: string | null;

  @Column({ type: "int", nullable: true })
  statusCode?: number | null;

  @Column({ type: "boolean", default: true })
  success: boolean;

  @Column({ type: "varchar", length: 64, nullable: true })
  ip?: string | null;

  @Column({ type: "varchar", length: 512, nullable: true })
  userAgent?: string | null;

  /** Cuerpo de la petición ya saneado (sin contraseñas ni tokens). */
  @Column({ type: "jsonb", nullable: true })
  details?: Record<string, unknown> | null;

  /** Mensaje de error cuando la acción falló. */
  @Column({ type: "text", nullable: true })
  error?: string | null;
}
