import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { InventoryMovementType } from '../../common/enums';

@Entity()
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => InventoryItem, (i) => i.movements, { eager: true }) item: InventoryItem;
  @Column({ type: 'enum', enum: InventoryMovementType }) type: InventoryMovementType;
  @Column({ type: 'int' }) quantity: number;
  @Column('text') note: string;
  @CreateDateColumn() timestamp: Date;
}

