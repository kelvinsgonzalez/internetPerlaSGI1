import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Base `internetperla_suspensiones`: suspensiones (con copia de los datos del
 * cliente), asignaciones a trabajadores, agenda de recordatorios y línea de
 * tiempo. Sin FK hacia la base principal: vive aparte a propósito.
 */
export class CreateSuspensiones1710000000200 implements MigrationInterface {
  name = "CreateSuspensiones1710000000200";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "suspensiones" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "cliente_nombre" text NOT NULL,
        "cliente_telefono" text,
        "cliente_direccion" text,
        "cliente_ip" text,
        "cliente_plan" text,
        "cliente_latitud" text,
        "cliente_longitud" text,
        "cliente_origen_id" text,
        "fecha_suspension" date NOT NULL,
        "monto_adeudado" numeric(12,2) NOT NULL DEFAULT 0,
        "anuncio" text NOT NULL,
        "estado" text NOT NULL DEFAULT 'SUSPENDIDO'
          CHECK ("estado" IN ('SUSPENDIDO','REACTIVADO_ACUERDO','RECOGER_EQUIPO','DESCONEXION')),
        "acuerdo_texto" text,
        "acuerdo_fechas" jsonb,
        "recoger_nota" text,
        "recoger_fecha" date,
        "desconexion_nota" text,
        "monto_pendiente_final" numeric(12,2),
        "creado_por_id" text,
        "creado_por_nombre" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_susp_estado" ON "suspensiones" ("estado")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_susp_cliente" ON "suspensiones" ("cliente_nombre")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_susp_fecha" ON "suspensiones" ("fecha_suspension")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "suspension_asignaciones" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "suspension_id" uuid NOT NULL REFERENCES "suspensiones"("id") ON DELETE CASCADE,
        "tipo" text NOT NULL CHECK ("tipo" IN ('RECOGER_EQUIPO','VISITA')),
        "instrucciones" text,
        "telefono_contacto" text,
        "fecha_programada" date,
        "trabajador_id" text NOT NULL,
        "trabajador_nombre" text,
        "asignado_por_id" text,
        "asignado_por_nombre" text,
        "estado" text NOT NULL DEFAULT 'PENDIENTE'
          CHECK ("estado" IN ('PENDIENTE','EN_PROCESO','DEVUELTA','CERRADA')),
        "resultado" text,
        "informe_trabajador" text,
        "evidencia_url" text,
        "iniciada_en" TIMESTAMP WITH TIME ZONE,
        "devuelta_en" TIMESTAMP WITH TIME ZONE,
        "revision_nota" text,
        "revisado_por_id" text,
        "revisado_por_nombre" text,
        "cerrada_en" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_susp_asig_suspension" ON "suspension_asignaciones" ("suspension_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_susp_asig_trabajador" ON "suspension_asignaciones" ("trabajador_id", "estado")`
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "suspension_agenda" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "suspension_id" uuid REFERENCES "suspensiones"("id") ON DELETE SET NULL,
        "asignacion_id" uuid,
        "origen" text NOT NULL DEFAULT 'MANUAL',
        "orden" int,
        "fecha" date NOT NULL,
        "hora" text,
        "tipo" text NOT NULL
          CHECK ("tipo" IN ('COBRO_ACUERDO','VISITA','RECOGER_EQUIPO','SEGUIMIENTO','OTRO')),
        "titulo" text NOT NULL,
        "nota" text,
        "cliente_nombre" text,
        "responsable_id" text,
        "responsable_nombre" text,
        "estado" text NOT NULL DEFAULT 'PENDIENTE' CHECK ("estado" IN ('PENDIENTE','HECHO','CANCELADO')),
        "resolucion_nota" text,
        "resuelto_por_nombre" text,
        "resuelto_en" TIMESTAMP WITH TIME ZONE,
        "creado_por_id" text,
        "creado_por_nombre" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_susp_agenda_fecha" ON "suspension_agenda" ("fecha", "estado")`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_susp_agenda_suspension" ON "suspension_agenda" ("suspension_id")`
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "suspension_eventos" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "suspension_id" uuid NOT NULL REFERENCES "suspensiones"("id") ON DELETE CASCADE,
        "tipo" text NOT NULL,
        "estado_anterior" text,
        "estado_nuevo" text,
        "nota" text,
        "datos" jsonb,
        "usuario_id" text,
        "usuario_nombre" text,
        "usuario_rol" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_susp_eventos_suspension" ON "suspension_eventos" ("suspension_id", "created_at")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "suspension_eventos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suspension_agenda"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suspension_asignaciones"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suspensiones"`);
  }
}
