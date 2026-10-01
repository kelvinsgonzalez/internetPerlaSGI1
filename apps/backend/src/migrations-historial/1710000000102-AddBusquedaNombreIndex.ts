import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Sugerencias de nombre/código mientras se escribe.
 *
 * La búsqueda es "contiene" (`LIKE '%texto%'`) sin acentos ni mayúsculas. Un
 * índice normal no sirve para eso; uno de trigramas (pg_trgm) sí. Se indexa la
 * MISMA expresión que usa la consulta (`NOMBRE_NORMALIZADO` en el servicio).
 *
 * Si el servidor no permite instalar pg_trgm, la migración no falla: la
 * búsqueda sigue funcionando, sólo que sin índice.
 */
const DE = "áàäâéèëêíìïîóòöôúùüûñÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑ";
const A = "aaaaeeeeiiiioooouuuunAAAAEEEEIIIIOOOOUUUUN";
const norm = (col: string) => `lower(translate(${col}, '${DE}', '${A}'))`;

export class AddBusquedaNombreIndex1710000000102 implements MigrationInterface {
  name = "AddBusquedaNombreIndex1710000000102";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
        CREATE INDEX IF NOT EXISTS idx_cobros_cliente_trgm ON cobros USING gin ((${norm("cliente")}) gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_cobros_codigo_trgm ON cobros USING gin ((${norm("codigo")}) gin_trgm_ops);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pg_trgm no disponible (%): la búsqueda por nombre funcionará sin índice', SQLERRM;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cobros_cliente_trgm`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cobros_codigo_trgm`);
  }
}
