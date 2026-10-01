import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Rol SUPERVISOR: gestiona Asistencia, Finanzas, Tareas, Mapa y Mensajes,
 * pero no puede crear, editar ni eliminar usuarios (eso sigue siendo ADMIN).
 */
export class AddSupervisorRole1710000000005 implements MigrationInterface {
  name = "AddSupervisorRole1710000000005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "user_role_enum" ADD VALUE IF NOT EXISTS 'SUPERVISOR'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres no permite quitar valores de un enum. Se degradan los
    // supervisores a USER para que el valor quede sin uso.
    await queryRunner.query(
      `UPDATE "user" SET "role" = 'USER' WHERE "role" = 'SUPERVISOR'`
    );
  }
}
