import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { InventoryStock } from './inventory-stock.entity';

@Entity()
export class Warehouse {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ nullable: true }) location?: string;
  @OneToMany(() => InventoryStock, (s) => s.warehouse) stocks: InventoryStock[];
}

