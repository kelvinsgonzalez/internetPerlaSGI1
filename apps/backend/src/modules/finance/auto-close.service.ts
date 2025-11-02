import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DateTime } from "luxon";
import cron from "node-cron";
import { FinanceService } from "./finance.service";

@Injectable()
export class AutoCloseService implements OnModuleInit {
  private readonly tz: string;
  private readonly enabled: boolean;

  constructor(
    private readonly cfg: ConfigService,
    private readonly finance: FinanceService
  ) {
    this.tz = this.cfg.get<string>("BUSINESS_TZ") || "America/Guatemala";
    this.enabled =
      (this.cfg.get<string>("AUTO_CLOSE_ENABLED") || "false") === "true";
  }

  async onModuleInit() {
    if (!this.enabled) {
      // eslint-disable-next-line no-console
      console.log(
        "[auto-close] Disabled. Set AUTO_CLOSE_ENABLED=true to enable."
      );
      return;
    }
    // Startup backfill for previous N days (exclude today)
    const N = 3;
    const today = DateTime.now().setZone(this.tz).startOf("day");
    for (let i = 1; i <= N; i++) {
      const d = today.minus({ days: i }).toISODate()!;
      try {
        const res = await this.finance.autoCloseDay(d);
        // eslint-disable-next-line no-console
        console.log("[auto-close][backfill]", d, res?.status || "ok");
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[auto-close][backfill] error for", d, err);
      }
    }

    // Schedule daily at 20:00 local business time
    // Cron: minute hour day month dayOfWeek => 0 20 * * *
    cron.schedule(
      "0 20 * * *",
      async () => {
        const dateISO = DateTime.now().setZone(this.tz).toISODate()!;
        // eslint-disable-next-line no-console
        console.log("[auto-close] trigger for", dateISO, "TZ:", this.tz);
        try {
          const res = await this.finance.autoCloseDay(dateISO);
          // eslint-disable-next-line no-console
          console.log("[auto-close] result", res?.status || "ok");
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[auto-close] error", err);
        }
      },
      { timezone: this.tz }
    );

    // eslint-disable-next-line no-console
    console.log("[auto-close] Scheduled daily at 20:00 in", this.tz);
  }
}
