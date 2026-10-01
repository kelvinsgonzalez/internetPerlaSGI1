import { Global, Logger, Module, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import cron from "node-cron";
import { AuditLog } from "./audit-log.entity";
import { AuditController } from "./audit.controller";
import { AuditInterceptor } from "./audit.interceptor";
import { AuditService } from "./audit.service";

/**
 * Global para que cualquier módulo (p. ej. Auth) pueda registrar eventos que
 * el interceptor no ve, como los inicios de sesión fallidos.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule implements OnModuleInit {
  private readonly logger = new Logger("Audit");

  constructor(private readonly audit: AuditService, private readonly cfg: ConfigService) {}

  /** Purga diaria (03:00) de registros más viejos que AUDIT_RETENTION_DAYS. 0 = conservar todo. */
  onModuleInit() {
    const days = Number.parseInt(this.cfg.get<string>("AUDIT_RETENTION_DAYS") ?? "365", 10);
    if (!Number.isFinite(days) || days <= 0) return;
    cron.schedule("0 3 * * *", async () => {
      const removed = await this.audit.purgeOlderThan(days).catch(() => 0);
      if (removed) this.logger.log(`Purgados ${removed} registros de más de ${days} días`);
    });
  }
}
