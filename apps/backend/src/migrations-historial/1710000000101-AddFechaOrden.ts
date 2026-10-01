import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * `fecha_orden`: la fecha del documento normalizada a texto ordenable
 * (`aaaa-mm-dd hh:mi:ss`), calculada por Postgres a partir de `fecha`.
 *
 * Al ser columna generada e indexada, consultar "los cobros del 14/09/26" lee
 * sólo ese rango del índice en lugar de interpretar la fecha de toda la tabla
 * en cada petición. Se arma como texto (nunca con to_timestamp) para que una
 * fecha imposible como 31/2/2021 no haga fallar la inserción. NULL si el
 * formato no se reconoce. Debe coincidir con `fechaKey` del servicio.
 *
 * Formatos: d/m/aaaa [h:mm[:ss]], d/m/aa (año = 20aa) y aaaa-mm-dd[ hh:mm[:ss]].
 */
const DMY = `regexp_match(btrim(fecha), '^(\\d{1,2})/(\\d{1,2})/(\\d{4}|\\d{2})(?:\\s+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?')`;
const YMD = `regexp_match(btrim(fecha), '^(\\d{4})-(\\d{2})-(\\d{2})(?:[T\\s](\\d{2}):(\\d{2})(?::(\\d{2}))?)?')`;

const EXPRESION = `
  CASE
    WHEN ${DMY} IS NOT NULL THEN
      (CASE WHEN length((${DMY})[3]) = 2 THEN '20' || (${DMY})[3] ELSE (${DMY})[3] END)
      || '-' || lpad((${DMY})[2], 2, '0') || '-' || lpad((${DMY})[1], 2, '0')
      || ' ' || lpad(coalesce((${DMY})[4], '0'), 2, '0')
      || ':' || coalesce((${DMY})[5], '00') || ':' || coalesce((${DMY})[6], '00')
    WHEN ${YMD} IS NOT NULL THEN
      (${YMD})[1] || '-' || (${YMD})[2] || '-' || (${YMD})[3]
      || ' ' || coalesce((${YMD})[4], '00') || ':' || coalesce((${YMD})[5], '00')
      || ':' || coalesce((${YMD})[6], '00')
  END`;

export class AddFechaOrden1710000000101 implements MigrationInterface {
  name = "AddFechaOrden1710000000101";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cobros" ADD COLUMN IF NOT EXISTS "fecha_orden" text GENERATED ALWAYS AS (${EXPRESION}) STORED`
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_cobros_fecha_orden" ON "cobros" ("fecha_orden")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cobros_fecha_orden"`);
    await queryRunner.query(`ALTER TABLE "cobros" DROP COLUMN IF EXISTS "fecha_orden"`);
  }
}
