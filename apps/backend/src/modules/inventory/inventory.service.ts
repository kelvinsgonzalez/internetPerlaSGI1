import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
  private async getOrCreateStock(
    itemId: string,
    warehouseId: string,
  ): Promise<InventoryStock> {
    let stock = await this.stocks.findByItemAndWarehouse(itemId, warehouseId);
    if (!stock) {
      const item = await this.items.findById(itemId);
      const warehouse = await this.warehouses.findById(warehouseId);
      if (!item || !warehouse)
        throw new NotFoundException('Item o almacén no encontrado.');
      stock = await this.stocks.save({ item, warehouse, quantity: 0 } as any);
    }
    return stock;
  }

  async move(dto: MovementDto): Promise<InventoryMovement> {
    // Validar item
    const item = await this.getItemById(dto.itemId);

    // Validar warehouse
    if (!dto.warehouseId) {
      throw new BadRequestException('warehouseId es obligatorio.');
    }
    const warehouse = await this.warehouses.findById(dto.warehouseId);
    if (!warehouse) {
      throw new NotFoundException('Almacén no encontrado.');
    }

    // Validar cantidad
    if (dto.quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0.');
    }

    // Obtener o crear stock
    const stock = await this.getOrCreateStock(dto.itemId, dto.warehouseId);

    // Procesar movimiento
    if (dto.type === 'IN') {
      stock.quantity += dto.quantity;
    } else if (dto.type === 'OUT') {
      if (stock.quantity < dto.quantity) {
        throw new BadRequestException(
          `Stock insuficiente. Disponible: ${stock.quantity}, Solicitado: ${dto.quantity}`,
        );
      }
      stock.quantity -= dto.quantity;
    } else {
      throw new BadRequestException(`Tipo de movimiento inválido: ${dto.type}`);
    }

    await this.stocks.save(stock);

    return this.movements.save({
      item,
      type: dto.type,
      quantity: dto.quantity,
      note: dto.note || 'Movimiento registrado',
    } as any);
  }

  async listStocks(): Promise<InventoryStock[]> {
    return this.stocks.list();
  }

  async listMovements(): Promise<InventoryMovement[]> {
    return this.movements.list();
  }
}
