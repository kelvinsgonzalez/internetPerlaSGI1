import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { ensureSuspensionesDatabase, suspensionesDataSourceOptions, suspensionesDbName } from "./suspensiones-db";

/**
 * Conexión propia a la base de suspensiones.
 *
 * Igual que el historial: se maneja aparte (no con TypeOrmModule.forRoot) para
 * que un fallo de esta base NO impida arrancar el CRM; si no conecta, sólo
 * Suspensiones responde 503. Al iniciar crea la base si falta y aplica sus
 * migraciones pendientes.
 */
@Injectable()
export class SuspensionesDatabase implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SuspensionesDatabase.name);
  private dataSource: DataSource | null = null;
  private connecting: Promise<void> | null = null;

  onModuleInit() {
    // No bloquea el arranque del resto de la app.
    void this.connect();
  }

  async onModuleDestroy() {
    if (this.dataSource?.isInitialized) await this.dataSource.destroy();
  }

  private connect() {
    if (!this.connecting) {
      this.connecting = (async () => {
        try {
          const name = suspensionesDbName();
          if (await ensureSuspensionesDatabase()) this.logger.log(`Base "${name}" creada.`);
          const ds = new DataSource(suspensionesDataSourceOptions());
          await ds.initialize();
          const ran = await ds.runMigrations({ transaction: "each" });
          if (ran.length) this.logger.log(`Migraciones de suspensiones aplicadas: ${ran.map((m) => m.name).join(", ")}`);
          this.dataSource = ds;
          this.logger.log(`Suspensiones conectado a "${name}".`);
        } catch (err: any) {
          this.logger.error(
            `No se pudo preparar la base de suspensiones: ${err?.message ?? err}. ` +
              `Créala a mano (CREATE DATABASE ${suspensionesDbName()};) o revisa SUSP_DB_*. El resto del CRM sigue funcionando.`
          );
          // Permite reintentar en la siguiente petición.
          this.connecting = null;
        }
      })();
    }
    return this.connecting;
  }

  async manager(): Promise<EntityManager> {
    if (!this.dataSource) await this.connect();
    if (!this.dataSource) throw new ServiceUnavailableException("Suspensiones no está disponible en este momento");
    return this.dataSource.manager;
  }

  async transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    await this.manager();
    return this.dataSource!.transaction(work);
  }
}
