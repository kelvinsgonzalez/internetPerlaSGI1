import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/**
 * Un pago histórico. Todo se guarda como TEXTO, tal cual viene del archivo de
 * origen (fechas, montos, meses...): el historial sólo se consulta, no se
 * calcula sobre él.
 *
 * El archivo se llama `.model.ts` (no `.entity.ts`) a propósito: el glob de
 * entidades de la base principal no debe recogerlo, porque vive en otra base.
 */
@Entity({ name: "cobros" })
export class CobroHistorico {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "ext_id", type: "text", nullable: true })
  extId: string | null;

  @Index()
  @Column({ type: "text" })
  cliente: string;

  @Column({ type: "text", nullable: true })
  ubicacion: string | null;

  @Column({ type: "text", nullable: true })
  concepto: string | null;

  @Column({ type: "text", nullable: true })
  fecha: string | null;

  @Column({ name: "meses_cancelados", type: "text", nullable: true })
  mesesCancelados: string | null;

  @Column({ name: "cantidad_meses", type: "text", nullable: true })
  cantidadMeses: string | null;

  @Column({ type: "text", nullable: true })
  total: string | null;

  @Column({ name: "forma_pago", type: "text", nullable: true })
  formaPago: string | null;

  @Column({ type: "text", nullable: true })
  cobrador: string | null;

  @Index()
  @Column({ type: "text", nullable: true })
  codigo: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}

/** Campos de datos (todo lo editable). */
export const COBRO_FIELDS = [
  "extId",
  "cliente",
  "ubicacion",
  "concepto",
  "fecha",
  "mesesCancelados",
  "cantidadMeses",
  "total",
  "formaPago",
  "cobrador",
  "codigo",
] as const;

export type CobroField = (typeof COBRO_FIELDS)[number];
