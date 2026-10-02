import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { TypeOrmModule } from "@nestjs/typeorm";
import { join } from "path";
import { SecurityModule } from "./common/security.module";
import { HealthController } from "./health.controller";
import { AuditModule } from "./modules/audit/audit.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { HistorialModule } from "./modules/historial/historial.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { SuspensionesModule } from "./modules/suspensiones/suspensiones.module";
import { TaskArchiveModule } from "./modules/task-archive/task-archive.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { UsersModule } from "./modules/users/users.module";
import { ReleasesModule } from "./modules/releases/releases.module";
import { RepositoriesModule } from "./repositories/repositories.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SecurityModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "uploads"),
      serveRoot: "/uploads",
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const sslPref = `${cfg.get('DB_SSL', 'true')}`.toLowerCase();
        const ssl = ['false', '0', 'off', 'no'].includes(sslPref)
          ? false
          : { rejectUnauthorized: false };

        const baseOptions = {
          type: 'postgres' as const,
          autoLoadEntities: true,
          synchronize: cfg.get('DB_SYNC') === 'true',
          // Las migraciones quedan registradas; se ejecutan al arrancar sólo si
          // DB_MIGRATIONS_RUN=true, y si no, con `npm run migration:run`.
          migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
          migrationsTableName: 'migrations',
          migrationsRun: cfg.get('DB_MIGRATIONS_RUN') === 'true',
          ssl,
        };

        const databaseUrl = cfg.get<string>('DATABASE_URL');
        if (databaseUrl) {
          return {
            ...baseOptions,
            url: databaseUrl,
          };
        }

        const portValue = cfg.get<string>('DB_PORT') ?? '5432';
        const port = Number.parseInt(portValue, 10) || 5432;

        return {
          ...baseOptions,
          host: cfg.get<string>('DB_HOST') ?? 'localhost',
          port,
          username: cfg.get<string>('DB_USERNAME') ?? 'postgres',
          password: `${cfg.get<string>('DB_PASSWORD') ?? ''}`,
          database: cfg.get<string>('DB_DATABASE') ?? 'internetperla',
        };
      },
    }),
    AuthModule,
    RepositoriesModule,
    UsersModule,
    CustomersModule,
    AttendanceModule,
    InventoryModule,
    FinanceModule,
    MessagesModule,
    TasksModule,
    TaskArchiveModule,
    HistorialModule,
    SuspensionesModule,
    AuditModule,
    ReleasesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
