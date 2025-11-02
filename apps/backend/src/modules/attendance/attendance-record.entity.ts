import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AttendanceType } from '../../common/enums';

@Entity()
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string; // nombre empleado (simple)
  @Column({ type: 'enum', enum: AttendanceType }) tipo: AttendanceType;
  @CreateDateColumn() timestamp: Date;
  @Column({ nullable: true }) note?: string;
}

