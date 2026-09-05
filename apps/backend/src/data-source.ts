import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { DataSource, DataSourceOptions } from "typeorm";

loadEnv();

/**
 * DataSource sólo para la CLI de TypeORM (`npm run migration:run`).
 * La aplicación configura su conexión en AppModule; ambas leen las mismas
 * variables de entorno para no divergir.
 */
export function buildDataSourceOptions(): DataSourceOptions {
  const sslPref = `${process.env.DB_SSL ?? "true"}`.toLowerCase();
  const ssl = ["false", "0", "off", "no"].includes(sslPref)
    ? false
    : { rejectUnauthorized: false };

  const base = {
    type: "postgres" as const,
    entities: [__dirname + "/**/*.entity{.ts,.js}"],
    migrations: [__dirname + "/migrations/*{.ts,.js}"],
    migrationsTableName: "migrations",
    synchronize: false,
    ssl,
  };

  if (process.env.DATABASE_URL) {
    return { ...base, url: process.env.DATABASE_URL };
  }

  return {
    ...base,
    host: process.env.DB_HOST ?? "localhost",
    port: Number.parseInt(process.env.DB_PORT ?? "5432", 10) || 5432,
    username: process.env.DB_USERNAME ?? "postgres",
    password: `${process.env.DB_PASSWORD ?? ""}`,
    database: process.env.DB_DATABASE ?? "internetperla",
  };
}

export default new DataSource(buildDataSourceOptions());
