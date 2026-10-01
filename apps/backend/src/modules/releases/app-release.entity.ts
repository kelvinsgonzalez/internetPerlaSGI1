import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";

/**
 * Nota de versión ("Novedades"). El ADMIN las publica y cada usuario ve las que
 * se publicaron después de la última vez que marcó las novedades como leídas
 * (`User.releasesSeenAt`).
 */
@Entity("app_release")
@Unique(["version"])
@Index(["publishedAt"])
export class AppRelease {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Número de versión visible, p. ej. "1.4.0". */
  @Column({ type: "varchar", length: 32 })
  version: string;

  @Column({ type: "varchar", length: 160 })
  title: string;

  /** Cambios, uno por línea. */
  @Column({ type: "text" })
  notes: string;

  /**
   * Roles a los que va dirigida; vacío = todos. Permite anunciar a los
   * colaboradores sólo lo que les afecta.
   */
  @Column({ type: "text", array: true, default: () => "'{}'" })
  audience: string[];

  @Column({ type: "timestamptz", default: () => "now()" })
  publishedAt: Date;

  @Column({ type: "varchar", length: 255, nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
