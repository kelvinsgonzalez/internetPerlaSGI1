import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { PayrollPeriodStatus } from '../../common/enums';
import { PayrollItem } from './payroll-item.entity';

@Entity()
export class PayrollPeriod {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'date' }) startDate: string;
  @Column({ type: 'date' }) endDate: string;
  @Column({ type: 'enum', enum: PayrollPeriodStatus, default: PayrollPeriodStatus.OPEN }) status: PayrollPeriodStatus;
  @OneToMany(() => PayrollItem, (i) => i.period) items: PayrollItem[];
}

