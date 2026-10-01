import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { DataSource } from "typeorm";
import { historialDataSourceOptions } from "./modules/historial/historial-db";

loadEnv();

/**
 * DataSource sólo para la CLI (`npm run migration:run:historial`).
 * La app crea la base y corre estas migraciones sola al arrancar
 * (ver HistorialDatabase); esto queda para hacerlo a mano si hace falta.
 */
export default new DataSource(historialDataSourceOptions());
