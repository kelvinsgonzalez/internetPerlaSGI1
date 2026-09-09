import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Marca de tiempo del último cambio de contraseña.
 *
 * Los JWT viven 7 días y hasta ahora seguían siendo válidos aunque el usuario
 * cambiara su contraseña o el admin bloqueara la cuenta: quien hubiera robado
 * un token conservaba el acceso una semana. Con esta columna, `JwtStrategy`
 * rechaza los tokens emitidos antes del último cambio.
 */
export class AddPasswordChangedAt1710000000004 implements MigrationInterface {
  name = "AddPasswordChangedAt1710000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP WITH TIME ZONE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "passwordChangedAt"`
    );
  }
}
