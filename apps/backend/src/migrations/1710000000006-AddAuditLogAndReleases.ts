import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bitácora de auditoría (`audit_log`) y Novedades por versión (`app_release`),
 * más la marca de lectura de novedades en cada usuario.
 *
 * Se publica además la primera nota de versión para que todos los usuarios
 * vean el aviso al entrar.
 */
export class AddAuditLogAndReleases1710000000006 implements MigrationInterface {
  name = "AddAuditLogAndReleases1710000000006";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_log" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "userId" uuid,
        "userEmail" varchar(255),
        "userName" varchar(255),
        "userRole" varchar(32),
        "action" varchar(32) NOT NULL,
        "module" varchar(64) NOT NULL,
        "method" varchar(8) NOT NULL,
        "path" varchar(512) NOT NULL,
        "entityId" varchar(128),
        "statusCode" integer,
        "success" boolean NOT NULL DEFAULT true,
        "ip" varchar(64),
        "userAgent" varchar(512),
        "details" jsonb,
        "error" text,
        CONSTRAINT "PK_audit_log_id" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_log_createdAt" ON "audit_log" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_log_userId" ON "audit_log" ("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_log_module" ON "audit_log" ("module")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_release" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "version" varchar(32) NOT NULL,
        "title" varchar(160) NOT NULL,
        "notes" text NOT NULL,
        "audience" text array NOT NULL DEFAULT '{}',
        "publishedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdBy" varchar(255),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_release_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_app_release_version" UNIQUE ("version")
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_app_release_publishedAt" ON "app_release" ("publishedAt")`);

    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "releasesSeenAt" TIMESTAMP WITH TIME ZONE`
    );

    await queryRunner.query(
      `INSERT INTO "app_release" ("version", "title", "notes", "audience", "createdBy")
       VALUES ($1, $2, $3, '{}', 'Sistema')
       ON CONFLICT ("version") DO NOTHING`,
      [
        "1.1.0",
        "Bitácora de auditoría y Novedades",
        [
          "Nuevo panel de Novedades: cada vez que publiquemos una versión verás aquí qué cambió.",
          "El ícono de regalo en el menú se marca cuando hay novedades sin leer.",
          "Administración: nueva Bitácora de auditoría con todo lo que se crea, edita o elimina en el sistema, y cada inicio de sesión.",
          "Rol Supervisor para gestionar Asistencia, Finanzas, Tareas, Mapa y Mensajes.",
          "Historial de cobros consultable desde el panel.",
        ].join("\n"),
      ]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "releasesSeenAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "app_release"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_log"`);
  }
}
