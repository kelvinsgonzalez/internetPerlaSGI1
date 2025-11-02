import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { InventoryStock } from './inventory-stock.entity';
import { InventoryMovement } from './inventory-movement.entity';

@Entity()
@Unique(['sku'])
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() sku: string;
  @Column() name: string;
  @Column() category: string;
  @Column({ type: 'int', default: 0 }) minStock: number;
  @OneToMany(() => InventoryStock, (s) => s.item) stocks: InventoryStock[];
  @OneToMany(() => InventoryMovement, (m) => m.item) movements: InventoryMovement[];
}

