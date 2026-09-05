import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { decimalTransformer } from "../../common/decimal.transformer";
@Entity()
export class Loan {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() employeeName: string;
  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer }) total: number;
  @Column('int') installments: number;
  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer }) balance: number;
}

