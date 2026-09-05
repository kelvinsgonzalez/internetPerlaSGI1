import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { decimalTransformer } from "../../common/decimal.transformer";
@Entity()
export class InternalDebt {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() employeeName: string;
  @Column('text') description: string;
  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer }) amount: number;
  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer }) balance: number;
}

