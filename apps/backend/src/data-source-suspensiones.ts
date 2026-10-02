import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { DataSource } from "typeorm";
import { suspensionesDataSourceOptions } from "./modules/suspensiones/suspensiones-db";

loadEnv();

/**
 * DataSource sólo para la CLI (`npm run migration:run:suspensiones`).
 * La app crea la base y corre estas migraciones sola al arrancar
 * (ver SuspensionesDatabase); esto queda para hacerlo a mano si hace falta.
 */
export default new DataSource(suspensionesDataSourceOptions());
