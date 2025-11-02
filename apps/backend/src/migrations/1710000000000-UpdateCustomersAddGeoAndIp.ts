import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCustomersAddGeoAndIp1710000000000
  implements MigrationInterface
{
  name = "UpdateCustomersAddGeoAndIp1710000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop email if exists and add ip/lat/lng
    await queryRunner.query(
      `ALTER TABLE "customer" DROP COLUMN IF EXISTS "email"`
    );
    await queryRunner.query(
      `ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "ip_asignada" character varying(50)`
    );
    await queryRunner.query(
      `ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "latitud" numeric(10,6)`
    );
    await queryRunner.query(
      `ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "longitud" numeric(10,6)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: drop new columns and add back email (nullable)
    await queryRunner.query(
      `ALTER TABLE "customer" DROP COLUMN IF EXISTS "ip_asignada"`
    );
    await queryRunner.query(
      `ALTER TABLE "customer" DROP COLUMN IF EXISTS "latitud"`
    );
    await queryRunner.query(
      `ALTER TABLE "customer" DROP COLUMN IF EXISTS "longitud"`
    );
    await queryRunner.query(
      `ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "email" character varying`
    );
  }
}
