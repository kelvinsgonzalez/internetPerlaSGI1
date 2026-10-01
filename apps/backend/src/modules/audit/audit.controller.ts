import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Response } from "express";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { Role } from "../users/user.entity";
import { AuditQuery, AuditService } from "./audit.service";

/** La bitácora sólo la consulta el ADMIN: muestra lo que hizo cada usuario. */
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(Role.ADMIN)
@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() q: AuditQuery) {
    return this.audit.list(q);
  }

  @Get("opciones")
  options() {
    return this.audit.options();
  }

  @Get("export")
  async export(@Res() res: Response, @Query() q: AuditQuery) {
    const csv = await this.audit.toCsv(q);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="bitacora-auditoria.csv"');
    res.send(csv);
  }
}
