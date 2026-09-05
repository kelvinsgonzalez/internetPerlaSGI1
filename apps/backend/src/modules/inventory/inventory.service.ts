import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InventoryItemsRepository } from '../../repositories/inventory-items.repository';
import { WarehousesRepository } from '../../repositories/warehouses.repository';
import { InventoryStocksRepository } from '../../repositories/inventory-stocks.repository';
import { InventoryMovementsRepository } from '../../repositories/inventory-movements.repository';
import { InventoryItem } from './inventory-item.entity';
import { CreateItemDto, UpdateItemDto, CreateWarehouseDto, MovementDto } from './dto';
import { Warehouse } from './warehouse.entity';
import { InventoryStock } from './inventory-stock.entity';
import { InventoryMovement } from './inventory-movement.entity';

@Injectable()
export class InventoryService {
  constructor(
    private items: InventoryItemsRepository,
    private warehouses: WarehousesRepository,
    private stocks: InventoryStocksRepository,
    private movements: InventoryMovementsRepository,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  // ========== ITEMS ==========
  async createItem(dto: CreateItemDto): Promise<InventoryItem> {
    const existing = await this.items.list();
    const duplicateSku = existing.find(
      (item: any) => item.sku.toLowerCase() === dto.sku.toLowerCase(),
    );
    if (duplicateSku) {
      throw new BadRequestException(`El SKU "${dto.sku}" ya existe.`);
    }
    const item = await this.items.save(dto);

    // Crear registros de stock en cero para todos los almacenes existentes
    const warehouses = await this.warehouses.list();
    if (warehouses?.length) {
      await Promise.all(
        warehouses.map(async (warehouse) => {
          const existingStock = await this.stocks.findByItemAndWarehouse(item.id, warehouse.id);
          if (!existingStock) {
            await this.stocks.save({ item, warehouse, quantity: 0 } as any);
          }
        }),
      );
    }

    return item;
  }

  async listItems(): Promise<InventoryItem[]> {
    return this.items.list();
  }

  async getItemById(id: string): Promise<InventoryItem> {
    const item = await this.items.findById(id);
    if (!item) throw new NotFoundException(`Item con ID "${id}" no encontrado.`);
    return item;
  }

  async updateItem(
    id: string,
    dto: UpdateItemDto,
  ): Promise<InventoryItem> {
    const item = await this.getItemById(id);

    if (dto.sku && dto.sku !== item.sku) {
      const existing = await this.items.list();
      const duplicateSku = existing.find(
        (i: any) => i.sku.toLowerCase() === (dto.sku || '').toLowerCase() && i.id !== id,
      );
      if (duplicateSku) {
        throw new BadRequestException(`El SKU "${dto.sku}" ya existe.`);
      }
    }

    Object.assign(item, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.minStock !== undefined && { minStock: Math.max(0, dto.minStock) }),
      ...(dto.sku !== undefined && { sku: dto.sku }),
    });

    return this.items.save(item);
  }

  async removeItem(id: string): Promise<{ deleted: boolean; message: string }> {
    const item = await this.getItemById(id);

    // Verificar si hay stock asociado
    const relatedStocks = (await this.stocks.list()).filter((s: any) => s.item?.id === id);

    if (relatedStocks.length) {
      await this.stocks.deleteByItemId(id);
    }
    await this.movements.deleteByItemId(id);
    await this.items.remove(item);
    return { deleted: true, message: 'Item eliminado exitosamente.' };
  }

  // ========== WAREHOUSES ==========
  async createWarehouse(dto: CreateWarehouseDto): Promise<Warehouse> {
    return this.warehouses.save(dto);
  }

  async listWarehouses(): Promise<Warehouse[]> {
    return this.warehouses.list();
  }

  // ========== STOCKS & MOVEMENTS ==========
  async move(dto: MovementDto): Promise<InventoryMovement> {
    if (!dto.warehouseId) {
      throw new BadRequestException('warehouseId es obligatorio.');
    }
    if (!Number.isInteger(dto.quantity) || dto.quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser un entero mayor a 0.');
    }
    if (dto.type !== 'IN' && dto.type !== 'OUT') {
      throw new BadRequestException(`Tipo de movimiento inválido: ${dto.type}`);
    }
    const warehouseId = dto.warehouseId;

    // Todo dentro de una transacción con bloqueo de la fila de stock: dos OUT
    // simultáneos sobre el mismo item ya no pueden dejar la existencia negativa.
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(InventoryItem, {
        where: { id: dto.itemId },
      });
      if (!item)
        throw new NotFoundException(`Item con ID "${dto.itemId}" no encontrado.`);

      const warehouse = await manager.findOne(Warehouse, {
        where: { id: warehouseId },
      });
      if (!warehouse) throw new NotFoundException('Almacén no encontrado.');

      // QueryBuilder en vez de findOne: las relaciones eager generan LEFT JOIN
      // y Postgres rechaza FOR UPDATE sobre el lado nullable de un outer join.
      let stock = await manager
        .createQueryBuilder(InventoryStock, 's')
        .setLock('pessimistic_write')
        .where('s."itemId" = :itemId AND s."warehouseId" = :warehouseId', {
          itemId: item.id,
          warehouseId: warehouse.id,
        })
        .getOne();

      if (!stock) {
        stock = await manager.save(
          InventoryStock,
          manager.create(InventoryStock, { item, warehouse, quantity: 0 }),
        );
      }

      if (dto.type === 'IN') {
        stock.quantity += dto.quantity;
      } else {
        if (stock.quantity < dto.quantity) {
          throw new BadRequestException(
            `Stock insuficiente. Disponible: ${stock.quantity}, Solicitado: ${dto.quantity}`,
          );
        }
        stock.quantity -= dto.quantity;
      }
      await manager.save(InventoryStock, stock);

      return manager.save(
        InventoryMovement,
        manager.create(InventoryMovement, {
          item,
          warehouse,
          type: dto.type,
          quantity: dto.quantity,
          note: dto.note || 'Movimiento registrado',
        }),
      );
    });
  }

  async listStocks(): Promise<InventoryStock[]> {
    return this.stocks.list();
  }

  async listMovements(): Promise<InventoryMovement[]> {
    return this.movements.list();
  }
}
