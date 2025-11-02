import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
@Index('idx_message_sender', ['sender'])
@Index('idx_message_recipient', ['recipient'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, eager: true, onDelete: 'CASCADE' })
  sender: User;

  @ManyToOne(() => User, { nullable: false, eager: true, onDelete: 'CASCADE' })
  recipient: User;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ default: false })
  read: boolean;
}
