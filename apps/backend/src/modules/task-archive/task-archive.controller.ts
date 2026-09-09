import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Response } from "express";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { TaskArchiveService } from "./task-archive.service";

@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles("ADMIN")
@Controller("task-archive")
export class TaskArchiveController {
  constructor(private readonly archive: TaskArchiveService) {}

  @Get()
  list(
    @Query("desde") desde?: string,
    @Query("hasta") hasta?: string,
    @Query("clienteId") clienteId?: string,
    @Query("trabajadorId") trabajadorId?: string
  ) {
    return this.archive.list({ desde, hasta, clienteId, trabajadorId });
  }

  /** Clientes y trabajadores que aparecen en el archivo, para los selectores. */
  @Get("opciones")
  options() {
    return this.archive.options();
  }

  /** Descarga el archivo (respetando los filtros) como texto plano legible. */
  @Get("export")
  async export(
    @Res() res: Response,
    @Query("desde") desde?: string,
    @Query("hasta") hasta?: string,
    @Query("clienteId") clienteId?: string,
    @Query("trabajadorId") trabajadorId?: string
  ) {
    const records = await this.archive.list({
      desde,
      hasta,
      clienteId,
      trabajadorId,
    });
    const text = this.archive.toPlainText(records);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="archivo-de-tareas.txt"'
    );
    res.send(text);
  }
}
