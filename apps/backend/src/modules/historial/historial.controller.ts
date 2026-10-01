import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { MANAGEMENT_ROLES, Role } from "../users/user.entity";
import { BorrarTodoDto, CreateCobroDto, ImportCobrosDto, UpdateCobroDto } from "./dto";
import { HistorialService, TodosQuery } from "./historial.service";

/**
 * Historial de cobros: ADMIN y SUPERVISOR consultan por cliente; sólo ADMIN
 * escribe y ve el listado completo de registros.
 * Las rutas específicas van antes de `:id`.
 */
@Controller("historial")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class HistorialController {
  constructor(private readonly service: HistorialService) {}

  @Get("buscar")
  @Roles(...MANAGEMENT_ROLES)
  buscar(@Query("q") q = "") {
    return this.service.buscar(q);
  }

  @Get("sugerencias")
  @Roles(Role.ADMIN)
  sugerencias(@Query("q") q = "") {
    return this.service.sugerencias(q);
  }

  @Get("todos")
  @Roles(Role.ADMIN)
  todos(@Query() query: TodosQuery) {
    return this.service.todos(query);
  }

  @Get("cliente")
  @Roles(...MANAGEMENT_ROLES)
  ficha(@Query("nombre") nombre = "") {
    return this.service.ficha(nombre);
  }

  @Post("import")
  @Roles(Role.ADMIN)
  importar(@Body() dto: ImportCobrosDto) {
    return this.service.importar(dto);
  }

  @Post()
  @Roles(Role.ADMIN)
  crear(@Body() dto: CreateCobroDto) {
    return this.service.crear(dto);
  }

  /** Vacía el historial completo para volver a cargarlo desde cero. */
  @Delete()
  @Roles(Role.ADMIN)
  borrarTodo(@Body() _dto: BorrarTodoDto) {
    return this.service.borrarTodo();
  }

  @Patch(":id")
  @Roles(Role.ADMIN)
  actualizar(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateCobroDto) {
    return this.service.actualizar(id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  eliminar(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.eliminar(id);
  }
}
