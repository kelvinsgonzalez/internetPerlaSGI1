import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Loan {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() employeeName: string;
  @Column('decimal', { precision: 12, scale: 2 }) total: number;
  @Column('int') installments: number;
  @Column('decimal', { precision: 12, scale: 2 }) balance: number;
}

