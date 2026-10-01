import { join } from "path";
import { DataSource, DataSourceOptions } from "typeorm";
import { CobroHistorico } from "./cobro-historico.model";

/**
 * El historial de cobros vive en su PROPIA base de datos (por defecto
 * `internetperla_historial`, en el mismo servidor Postgres). Ningún otro
 * módulo la usa, así se puede respaldar, mover o borrar sin tocar el CRM.
 *
 * Variables (todas opcionales; si faltan se usan las DB_* de la base principal):
 *   HIST_DATABASE_URL | HIST_DB_HOST, HIST_DB_PORT, HIST_DB_USERNAME,
 *   HIST_DB_PASSWORD, HIST_DB_DATABASE, HIST_DB_SSL
 */
const DEFAULT_DB_NAME = "internetperla_historial";
const SAFE_DB_NAME = /^[a-z0-9_]+$/;

type Env = Record<string, string | undefined>;

function sslFrom(env: Env) {
  const pref = `${env.HIST_DB_SSL ?? env.DB_SSL ?? "true"}`.toLowerCase();
  return ["false", "0", "off", "no"].includes(pref) ? false : { rejectUnauthorized: false };
}

export function historialDbName(env: Env = process.env) {
  const name = env.HIST_DB_DATABASE || DEFAULT_DB_NAME;
  if (!SAFE_DB_NAME.test(name)) {
    throw new Error(`HIST_DB_DATABASE inválido: "${name}" (sólo a-z, 0-9 y _)`);
  }
  return name;
}

/** Conexión al servidor: URL completa o parámetros sueltos, apuntando a `database`. */
function connectionFor(env: Env, database: string) {
  const explicitUrl = env.HIST_DATABASE_URL;
  if (explicitUrl) {
    const url = new URL(explicitUrl);
    if (database !== historialDbName(env)) url.pathname = `/${database}`;
    return { url: url.toString() };
  }
  if (env.DATABASE_URL && !env.HIST_DB_HOST) {
    // Misma instancia que la base principal, otra base de datos.
    const url = new URL(env.DATABASE_URL);
    url.pathname = `/${database}`;
    return { url: url.toString() };
  }
  return {
    host: env.HIST_DB_HOST ?? env.DB_HOST ?? "localhost",
    port: Number.parseInt(env.HIST_DB_PORT ?? env.DB_PORT ?? "5432", 10) || 5432,
    username: env.HIST_DB_USERNAME ?? env.DB_USERNAME ?? "postgres",
    password: `${env.HIST_DB_PASSWORD ?? env.DB_PASSWORD ?? ""}`,
    database,
  };
}

export function historialDataSourceOptions(env: Env = process.env): DataSourceOptions {
  return {
    type: "postgres",
    ...connectionFor(env, historialDbName(env)),
    ssl: sslFrom(env),
    entities: [CobroHistorico],
    migrations: [join(__dirname, "..", "..", "migrations-historial", "*{.ts,.js}")],
    migrationsTableName: "migrations",
    synchronize: false,
  };
}

/** Crea la base del historial si todavía no existe (requiere permiso CREATEDB). */
export async function ensureHistorialDatabase(env: Env = process.env) {
  const name = historialDbName(env);
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
