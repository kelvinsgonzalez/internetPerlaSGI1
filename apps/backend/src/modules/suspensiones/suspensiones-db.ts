import { join } from "path";
import { DataSource, DataSourceOptions } from "typeorm";
import { SUSPENSIONES_MODELS } from "./suspension.model";

/**
 * Las suspensiones viven en su PROPIA base de datos (por defecto
 * `internetperla_suspensiones`, en el mismo servidor Postgres). No dependen de
 * Clientes ni de Tareas: los clientes se pueden borrar o reimportar y el
 * seguimiento de una suspensión no se pierde.
 *
 * Variables (todas opcionales; si faltan se usan las DB_* de la base principal):
 *   SUSP_DATABASE_URL | SUSP_DB_HOST, SUSP_DB_PORT, SUSP_DB_USERNAME,
 *   SUSP_DB_PASSWORD, SUSP_DB_DATABASE, SUSP_DB_SSL
 */
const DEFAULT_DB_NAME = "internetperla_suspensiones";
const SAFE_DB_NAME = /^[a-z0-9_]+$/;

type Env = Record<string, string | undefined>;

function sslFrom(env: Env) {
  const pref = `${env.SUSP_DB_SSL ?? env.DB_SSL ?? "true"}`.toLowerCase();
  return ["false", "0", "off", "no"].includes(pref) ? false : { rejectUnauthorized: false };
}

export function suspensionesDbName(env: Env = process.env) {
  const name = env.SUSP_DB_DATABASE || DEFAULT_DB_NAME;
  if (!SAFE_DB_NAME.test(name)) {
    throw new Error(`SUSP_DB_DATABASE inválido: "${name}" (sólo a-z, 0-9 y _)`);
  }
  return name;
}

/** Conexión al servidor: URL completa o parámetros sueltos, apuntando a `database`. */
function connectionFor(env: Env, database: string) {
  const explicitUrl = env.SUSP_DATABASE_URL;
  if (explicitUrl) {
    const url = new URL(explicitUrl);
    if (database !== suspensionesDbName(env)) url.pathname = `/${database}`;
    return { url: url.toString() };
  }
  if (env.DATABASE_URL && !env.SUSP_DB_HOST) {
    // Misma instancia que la base principal, otra base de datos.
    const url = new URL(env.DATABASE_URL);
    url.pathname = `/${database}`;
    return { url: url.toString() };
  }
  return {
    host: env.SUSP_DB_HOST ?? env.DB_HOST ?? "localhost",
    port: Number.parseInt(env.SUSP_DB_PORT ?? env.DB_PORT ?? "5432", 10) || 5432,
    username: env.SUSP_DB_USERNAME ?? env.DB_USERNAME ?? "postgres",
    password: `${env.SUSP_DB_PASSWORD ?? env.DB_PASSWORD ?? ""}`,
    database,
  };
}

export function suspensionesDataSourceOptions(env: Env = process.env): DataSourceOptions {
  return {
    type: "postgres",
    ...connectionFor(env, suspensionesDbName(env)),
    ssl: sslFrom(env),
    entities: SUSPENSIONES_MODELS,
    migrations: [join(__dirname, "..", "..", "migrations-suspensiones", "*{.ts,.js}")],
    migrationsTableName: "migrations",
    synchronize: false,
  };
}

/** Crea la base de suspensiones si todavía no existe (requiere permiso CREATEDB). */
export async function ensureSuspensionesDatabase(env: Env = process.env) {
  const name = suspensionesDbName(env);
  // Conexión temporal a la base de mantenimiento `postgres` del mismo servidor.
  const admin = new DataSource({ type: "postgres", ...connectionFor(env, "postgres"), ssl: sslFrom(env) });
  await admin.initialize();
  try {
    const rows = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!rows.length) {
      // El nombre ya pasó por SAFE_DB_NAME: no hay riesgo de inyección.
      await admin.query(`CREATE DATABASE "${name}"`);
      return true;
    }
    return false;
  } finally {
    await admin.destroy();
  }
}
