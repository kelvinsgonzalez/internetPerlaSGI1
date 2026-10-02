import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import type { Response } from "express";
import { diskStorage } from "multer";
import { v4 as uuidv4 } from "uuid";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { MANAGEMENT_ROLES, Role } from "../users/user.entity";
import {
  AgendaQuery,
  CambiarEstadoDto,
  CompletarAsignacionDto,
  CrearAgendaDto,
  CrearAsignacionDto,
  CreateSuspensionDto,
  EditarAgendaDto,
  EliminarAgendaDto,
  EliminarSuspensionDto,
  ListarQuery,
  ResolverAgendaDto,
  RevisarAsignacionDto,
  UpdateSuspensionDto,
} from "./dto";
import { SuspensionesService } from "./suspensiones.service";

// Sólo imágenes: /uploads se sirve como estático desde el mismo origen que el
// API, así que aceptar html/svg permitiría ejecutar scripts en ese origen.
const ALLOWED_EVIDENCE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
};

const evidenciaUpload: MulterOptions = {
  storage: diskStorage({
    destination: (req, file, cb) => cb(null, process.cwd() + "/uploads"),
    // La extensión sale del mime validado, nunca del nombre que manda el cliente.
    filename: (req, file, cb) => cb(null, `${uuidv4()}.${ALLOWED_EVIDENCE_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_EVIDENCE_TYPES[file.mimetype]) {
      cb(
        new BadRequestException(`Formato no permitido (${file.mimetype}). Sube una imagen JPG, PNG, WEBP, GIF o HEIC.`),
        false
      );
      return;
    }
    cb(null, true);
  },
};

/**
 * Suspensiones: ADMIN crea y elimina; ADMIN y SUPERVISOR dan seguimiento,
 * asignan visitas/recolecciones y manejan la agenda. El trabajador (USER) sólo
 * ve y entrega SUS asignaciones; nunca ve la agenda.
 * Las rutas específicas van antes de `:id`.
 */
@Controller("suspensiones")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class SuspensionesController {
  constructor(private readonly service: SuspensionesService) {}

  // ----------------------------------------------------------- generales

  @Get()
  @Roles(...MANAGEMENT_ROLES)
  listar(@Query() q: ListarQuery) {
    return this.service.listar(q);
  }

  @Get("log/export")
  @Roles(...MANAGEMENT_ROLES)
  async exportarLog(@Res() res: Response, @Query("desde") desde?: string, @Query("hasta") hasta?: string) {
    const text = await this.service.exportarLog(desde, hasta);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="suspensiones-log.txt"');
    res.send(text);
  }

  @Get("usuarios")
  @Roles(...MANAGEMENT_ROLES)
  usuarios() {
    return this.service.usuarios();
  }

  @Get("por-revisar")
  @Roles(...MANAGEMENT_ROLES)
  porRevisar() {
    return this.service.porRevisar();
  }

  // -------------------------------------------------- vista del trabajador

  @Get("mis-asignaciones")
  @Roles(Role.USER)
  misAsignaciones(@Req() req: any) {
    return this.service.misAsignaciones(req.user);
  }

  @Patch("asignaciones/:id/iniciar")
  @Roles(Role.USER)
  iniciar(@Param("id", new ParseUUIDPipe()) id: string, @Req() req: any) {
    return this.service.iniciar(id, req.user);
  }

  @Patch("asignaciones/:id/completar")
  @Roles(Role.USER)
  @UseInterceptors(FileInterceptor("evidencia", evidenciaUpload))
  completar(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CompletarAsignacionDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: any
  ) {
    const url = file ? `/uploads/${file.filename}` : null;
    return this.service.completar(id, dto, url, req.user);
  }

  @Patch("asignaciones/:id/revisar")
  @Roles(...MANAGEMENT_ROLES)
  revisar(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: RevisarAsignacionDto, @Req() req: any) {
    return this.service.revisar(id, dto, req.user);
  }

  // ---------------------------------------------------------------- agenda

  @Get("agenda")
  @Roles(...MANAGEMENT_ROLES)
  agenda(@Query() q: AgendaQuery) {
    return this.service.agendaListar(q);
  }

  @Get("agenda/resumen")
  @Roles(...MANAGEMENT_ROLES)
  agendaResumen() {
    return this.service.agendaResumen();
  }

  @Get("agenda/ics")
  @Roles(...MANAGEMENT_ROLES)
  async agendaIcs(@Res() res: Response, @Query("desde") desde?: string, @Query("hasta") hasta?: string) {
    const ics = await this.service.agendaIcs(desde, hasta);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="agenda-suspensiones.ics"');
    res.send(ics);
  }

  @Post("agenda")
  @Roles(...MANAGEMENT_ROLES)
  agendaCrear(@Body() dto: CrearAgendaDto, @Req() req: any) {
    return this.service.agendaCrear(dto, req.user);
  }

  @Patch("agenda/:id/resolver")
  @Roles(...MANAGEMENT_ROLES)
  agendaResolver(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: ResolverAgendaDto, @Req() req: any) {
    return this.service.agendaResolver(id, dto, req.user);
  }

  @Patch("agenda/:id")
  @Roles(...MANAGEMENT_ROLES)
  agendaEditar(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: EditarAgendaDto, @Req() req: any) {
    return this.service.agendaEditar(id, dto, req.user);
  }

  @Delete("agenda/:id")
  @Roles(...MANAGEMENT_ROLES)
  agendaEliminar(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: EliminarAgendaDto, @Req() req: any) {
    return this.service.agendaEliminar(id, dto, req.user);
  }

  // -------------------------------------------------------- por suspensión

  @Post()
  @Roles(Role.ADMIN)
  crear(@Body() dto: CreateSuspensionDto, @Req() req: any) {
    return this.service.crear(dto, req.user);
  }

  @Get(":id")
  @Roles(...MANAGEMENT_ROLES)
  obtener(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.obtener(id);
  }

  @Patch(":id/estado")
  @Roles(...MANAGEMENT_ROLES)
  cambiarEstado(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: CambiarEstadoDto, @Req() req: any) {
    return this.service.cambiarEstado(id, dto, req.user);
  }

  @Post(":id/asignaciones")
  @Roles(...MANAGEMENT_ROLES)
  asignar(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: CrearAsignacionDto, @Req() req: any) {
    return this.service.asignar(id, dto, req.user);
  }

  @Patch(":id")
  @Roles(...MANAGEMENT_ROLES)
  editar(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateSuspensionDto, @Req() req: any) {
    return this.service.editar(id, dto, req.user);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  eliminar(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: EliminarSuspensionDto, @Req() req: any) {
    return this.service.eliminar(id, dto.motivo, req.user);
  }
}
