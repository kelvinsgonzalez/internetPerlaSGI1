import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLocationTimestampAndMovementWarehouse1710000000002
  implements MigrationInterface
{
  name = "AddLocationTimestampAndMovementWarehouse1710000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Momento del último reporte de ubicación: permite calcular si un
    // colaborador sigue activo en vez de simularlo en el cliente.
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "locationUpdatedAt" TIMESTAMP WITH TIME ZONE`
    );

    // Almacén del movimiento: hasta ahora el stock se descontaba del almacén
    // correcto pero el historial no guardaba de cuál salió.
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" ADD COLUMN IF NOT EXISTS "warehouseId" uuid`
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_inventory_movement_warehouse'
        ) THEN
          ALTER TABLE "inventory_movement"
            ADD CONSTRAINT "FK_inventory_movement_warehouse"
            FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id")
            ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" DROP CONSTRAINT IF EXISTS "FK_inventory_movement_warehouse"`
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movement" DROP COLUMN IF EXISTS "warehouseId"`
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "locationUpdatedAt"`
    );
  }
}
