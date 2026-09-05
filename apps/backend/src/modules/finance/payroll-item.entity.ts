import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PayrollItemType } from '../../common/enums';
import { PayrollPeriod } from './payroll-period.entity';

import { decimalTransformer } from "../../common/decimal.transformer";
@Entity()
export class PayrollItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => PayrollPeriod, (p) => p.items, { eager: true }) period: PayrollPeriod;
  @Column({ type: 'enum', enum: PayrollItemType }) type: PayrollItemType;
  @Column('decimal', { precision: 12, scale: 2, transformer: decimalTransformer }) amount: number;
  @Column() employeeName: string;
}

