import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { CobroHistorico } from "./cobro-historico.model";
import { ensureHistorialDatabase, historialDataSourceOptions, historialDbName } from "./historial-db";

/**
 * Conexión propia a la base del historial.
 *
 * Se maneja aparte (no con TypeOrmModule.forRoot) para que un fallo de esta
 * base NO impida arrancar el CRM: si no conecta, sólo el historial responde 503.
 * Al iniciar crea la base si falta y aplica sus migraciones pendientes; como es
 * una base exclusiva del historial, no afecta a nada más.
 */
@Injectable()
export class HistorialDatabase implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HistorialDatabase.name);
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
          const name = historialDbName();
          if (await ensureHistorialDatabase()) this.logger.log(`Base "${name}" creada.`);
          const ds = new DataSource(historialDataSourceOptions());
          await ds.initialize();
          const ran = await ds.runMigrations({ transaction: "each" });
          if (ran.length) this.logger.log(`Migraciones del historial aplicadas: ${ran.map((m) => m.name).join(", ")}`);
          this.dataSource = ds;
          this.logger.log(`Historial conectado a "${name}".`);
        } catch (err: any) {
          this.logger.error(
            `No se pudo preparar la base del historial: ${err?.message ?? err}. ` +
              `Créala a mano (CREATE DATABASE ${historialDbName()};) o revisa HIST_DB_*. El resto del CRM sigue funcionando.`
          );
          // Permite reintentar en la siguiente petición.
          this.connecting = null;
        }
      })();
    }
    return this.connecting;
  }

  async cobros(): Promise<Repository<CobroHistorico>> {
    if (!this.dataSource) await this.connect();
    if (!this.dataSource) throw new ServiceUnavailableException("El historial no está disponible en este momento");
    return this.dataSource.getRepository(CobroHistorico);
  }

  async transaction<T>(work: (repo: Repository<CobroHistorico>) => Promise<T>): Promise<T> {
    await this.cobros();
    return this.dataSource!.transaction((manager) => work(manager.getRepository(CobroHistorico)));
  }
}
