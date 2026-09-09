import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Traslada la cuenta de administrador antigua a la nueva y retira la anterior.
 *
 * Los correos NO están escritos aquí: salen del entorno, para que el repositorio
 * no revele ninguna cuenta real contra la que dirigir un ataque.
 *
 *   LEGACY_ADMIN_EMAIL=...   correo a retirar (si está vacío, la migración no hace nada)
 *   ADMIN_EMAIL=...          correo destino
 *
 * Las relaciones (tareas, mensajes, cierres de caja) apuntan al id del usuario y
 * sobreviven al cambio sin tocarlas. Lo que sí se reescribe son las columnas
 * donde el correo quedó copiado como texto.
 */
export class MigrateLegacyAdminEmail1710000000003 implements MigrationInterface {
  name = "MigrateLegacyAdminEmail1710000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cuentas dadas de baja: se bloquean también en la base, no sólo en la capa
    // de aplicación. Así siguen inservibles aunque alguien retire la variable de
    // entorno más adelante.
    const retired = (process.env.RETIRED_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (retired.length > 0) {
      await queryRunner.query(
        `UPDATE "user" SET "isBlocked" = true WHERE lower(email) = ANY($1)`,
        [retired]
      );
    }

    const legacy = process.env.LEGACY_ADMIN_EMAIL?.trim().toLowerCase();
    if (!legacy) return; // Instalación nueva: no hay nada que migrar.

    const current = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!current) {
      throw new Error(
        "LEGACY_ADMIN_EMAIL está definido pero falta ADMIN_EMAIL: no se sabe a qué cuenta migrar."
      );
    }
    if (legacy === current) return;

    const [{ legacy_count: legacyCount, current_count: currentCount }] =
      await queryRunner.query(
        `SELECT
           COUNT(*) FILTER (WHERE lower(email) = $1) AS legacy_count,
           COUNT(*) FILTER (WHERE lower(email) = $2) AS current_count
         FROM "user"`,
        [legacy, current]
      );

    if (Number(legacyCount) > 0) {
      if (Number(currentCount) === 0) {
        // Caso normal: se renombra la cuenta y conserva id, rol e historial.
        await queryRunner.query(
          `UPDATE "user" SET email = $1 WHERE lower(email) = $2`,
          [current, legacy]
        );
      } else {
        // Ya existe la cuenta nueva: no se puede renombrar (email es UNIQUE).
        // La antigua se bloquea para que no sirva como puerta trasera.
        await queryRunner.query(
          `UPDATE "user" SET "isBlocked" = true WHERE lower(email) = $1`,
          [legacy]
        );
      }
    }

    // Copias del correo guardadas como texto plano en columnas de auditoría.
    // `to_regclass` evita fallar en bases donde la tabla aún no exista.
    const rewrites: Array<[string, string]> = [
      ["cash_daily_summary", "closedBy"],
      ["cash_entry", "createdBy"],
      ["attendance_record", "name"],
    ];
    for (const [table, column] of rewrites) {
      const [{ exists }] = await queryRunner.query(
        `SELECT to_regclass($1) IS NOT NULL AS exists`,
        [`public.${table}`]
      );
      if (!exists) continue;
      await queryRunner.query(
        `UPDATE "${table}" SET "${column}" = $1 WHERE lower("${column}") = $2`,
        [current, legacy]
      );
    }
  }

  public async down(): Promise<void> {
    // Sin vuelta atrás a propósito: la cuenta antigua está retirada y
    // restaurarla reintroduciría credenciales ya conocidas.
  }
}
