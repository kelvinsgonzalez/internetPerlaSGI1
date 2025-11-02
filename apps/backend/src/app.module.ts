import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { TypeOrmModule } from "@nestjs/typeorm";
import { join } from "path";
import { HealthController } from "./health.controller";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { UsersModule } from "./modules/users/users.module";
import { RepositoriesModule } from "./repositories/repositories.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
