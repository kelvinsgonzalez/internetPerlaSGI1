import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Base `internetperla_historial`: tabla única de cobros históricos.
 * Todas las columnas de datos son TEXT: se guardan tal cual vienen del archivo.
 */
export class CreateCobrosHistorico1710000000100 implements MigrationInterface {
  name = "CreateCobrosHistorico1710000000100";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cobros" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ext_id" text,
        "cliente" text NOT NULL,
        "ubicacion" text,
        "concepto" text,
        "fecha" text,
        "meses_cancelados" text,
        "cantidad_meses" text,
        "total" text,
        "forma_pago" text,
        "cobrador" text,
        "codigo" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_cobros_cliente" ON "cobros" ("cliente")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_cobros_codigo" ON "cobros" ("codigo")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_cobros_ext_id" ON "cobros" ("ext_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cobros"`);
  }
}
