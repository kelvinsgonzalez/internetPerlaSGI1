import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameCustomerColumnsToSpanish1710000000001
  implements MigrationInterface
{
  name = "RenameCustomerColumnsToSpanish1710000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // NOTE: This migration is prepared but NOT auto-run. Execute manually when ready.
    // It renames columns to Spanish equivalents. Make sure to update entity column names
    // in Customer entity before or right after running this.

    await queryRunner.query(
      `ALTER TABLE "customer" RENAME COLUMN "name" TO "nombre_completo"`
    );
    await queryRunner.query(
      `ALTER TABLE "customer" RENAME COLUMN "address" TO "direccion"`
    );
    await queryRunner.query(
      `ALTER TABLE "customer" RENAME COLUMN "status" TO "estado_cliente"`
    );
    // plan foreign key column left unchanged intentionally
    await queryRunner.query(
      `ALTER TABLE "customer" RENAME COLUMN "notes" TO "notas"`
    );
    // Existing columns already Spanish-friendly: ip_asignada, latitud, longitud
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer" RENAME COLUMN "notas" TO "notes"`
    );
    await queryRunner.query(
      `ALTER TABLE "customer" RENAME COLUMN "estado_cliente" TO "status"`
    );
    await queryRunner.query(
      `ALTER TABLE "customer" RENAME COLUMN "direccion" TO "address"`
    );
    await queryRunner.query(
      `ALTER TABLE "customer" RENAME COLUMN "nombre_completo" TO "name"`
    );
  }
}
