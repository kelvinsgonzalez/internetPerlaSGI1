import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { InventoryMovementType } from '../../common/enums';

export class CreateItemDto {
  @IsString() sku: string;
  @IsString() name: string;
  @IsString() category: string;
  @IsInt() @Min(0) minStock: number;
}

export class UpdateItemDto {
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsInt() @Min(0) minStock?: number;
}

export class CreateWarehouseDto {
  @IsString() name: string;
  @IsOptional() @IsString() location?: string;
}

export class MovementDto {
  @IsString() itemId: string;
  @IsEnum(InventoryMovementType) type: InventoryMovementType;
  @IsInt() @Min(1) quantity: number;
  @IsString() note: string;
  @IsOptional() @IsString() warehouseId?: string;
}

