import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateItemDto, UpdateItemDto, CreateWarehouseDto, MovementDto } from './dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private service: InventoryService) {}

  // ========== ITEMS (CRUD) ==========
  @Get('items')
  listItems() {
    return this.service.listItems();
  }

  @Post('items')
  @Roles('ADMIN')
  createItem(@Body() dto: CreateItemDto) {
    if (!dto.sku?.trim() || !dto.name?.trim()) {
      throw new BadRequestException('SKU y nombre son obligatorios.');
    }
    return this.service.createItem(dto);
  }

  @Patch('items/:id')
  @Roles('ADMIN')
  updateItem(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    if (!id) throw new BadRequestException('ID del item es obligatorio.');
    return this.service.updateItem(id, dto);
  }

  @Delete('items/:id')
  @Roles('ADMIN')
  removeItem(@Param('id') id: string) {
    if (!id) throw new BadRequestException('ID del item es obligatorio.');
    return this.service.removeItem(id);
  }

  // ========== WAREHOUSES ==========
  @Get('warehouses')
  listWarehouses() {
    return this.service.listWarehouses();
  }

  @Post('warehouses')
  @Roles('ADMIN')
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('El nombre del almacén es obligatorio.');
    }
    return this.service.createWarehouse(dto);
  }

  // ========== STOCKS & MOVEMENTS ==========
  @Get('stocks')
  listStocks() {
    return this.service.listStocks();
  }

  @Get('movements')
  listMovements() {
    return this.service.listMovements();
  }

  @Post('movements')
  move(@Body() dto: MovementDto) {
    if (!dto.itemId || !dto.warehouseId) {
      throw new BadRequestException('itemId y warehouseId son obligatorios.');
    }
    if (!dto.type || !['IN', 'OUT'].includes(dto.type)) {
      throw new BadRequestException('type debe ser "IN" o "OUT".');
    }
    if (!Number.isInteger(dto.quantity) || dto.quantity <= 0) {
      throw new BadRequestException('quantity debe ser un número entero positivo.');
    }
    return this.service.move(dto);
  }
}

