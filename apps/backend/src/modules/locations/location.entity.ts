import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, ForeignKey } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('worker_locations')
export class WorkerLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('double precision')
  lat: number;

  @Column('double precision')
  lng: number;

  @CreateDateColumn()
  createdAt: Date;
}
