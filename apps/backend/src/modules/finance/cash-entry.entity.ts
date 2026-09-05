import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

import { decimalTransformer } from "../../common/decimal.transformer";
export type CashEntryType = "INCOME" | "EXPENSE";

@Entity()
export class CashEntry {
  @PrimaryGeneratedColumn("uuid") id: string;

  // Fecha base del corte (día al que pertenece el movimiento)
  @Column({ type: "date" }) entryDate: string;

  @Column({ type: "enum", enum: ["INCOME", "EXPENSE"] }) type: CashEntryType;

  @Column("text") description: string;

  @Column("decimal", { precision: 12, scale: 2, transformer: decimalTransformer }) amount: number;

  @CreateDateColumn() createdAt: Date;

  // Auditoría del creador
  @Column({ nullable: true }) createdBy?: string; // email del usuario que registra (compatibilidad)
  @Column({ nullable: true }) createdById?: string; // user.id del creador
  @Column({ nullable: true }) createdByName?: string; // nombre visible del creador
}
