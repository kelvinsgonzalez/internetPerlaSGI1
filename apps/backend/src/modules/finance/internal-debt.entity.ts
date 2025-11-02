import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class InternalDebt {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() employeeName: string;
  @Column('text') description: string;
  @Column('decimal', { precision: 12, scale: 2 }) amount: number;
  @Column('decimal', { precision: 12, scale: 2 }) balance: number;
}

