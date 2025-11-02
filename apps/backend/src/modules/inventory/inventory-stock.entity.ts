import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { Warehouse } from './warehouse.entity';

@Entity()
@Unique(['item','warehouse'])
export class InventoryStock {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => InventoryItem, (i) => i.stocks, { eager: true }) item: InventoryItem;
  @ManyToOne(() => Warehouse, (w) => w.stocks, { eager: true }) warehouse: Warehouse;
  @Column({ type: 'int', default: 0 }) quantity: number;
}

