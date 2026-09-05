import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { diskStorage } from "multer";
import { v4 as uuidv4 } from "uuid";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CreateTaskDto, UpdateTaskDto } from "./dto";
import { TasksService } from "./tasks.service";

// Sólo imágenes: /uploads se sirve como estático desde el mismo origen que el
// API, así que aceptar html/svg permitiría ejecutar scripts en ese origen.
const ALLOWED_PROOF_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
};

const MAX_PROOF_BYTES = 10 * 1024 * 1024; // 10 MB

const proofUpload: MulterOptions = {
  storage: diskStorage({
    destination: (req, file, cb) => cb(null, process.cwd() + "/uploads"),
    // La extensión sale del mime validado, nunca del nombre que manda el cliente.
    filename: (req, file, cb) =>
      cb(null, `${uuidv4()}.${ALLOWED_PROOF_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: MAX_PROOF_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_PROOF_TYPES[file.mimetype]) {
      cb(
        new BadRequestException(
          `Formato no permitido (${file.mimetype}). Sube una imagen JPG, PNG, WEBP, GIF o HEIC.`
        ),
        false
      );
      return;
    }
    cb(null, true);
  },
};

@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("tasks")
export class TasksController {
  constructor(private service: TasksService) {}

  @Post()
  @Roles("ADMIN")
  create(@Body() dto: CreateTaskDto, @Req() req: any) {
    return this.service.create(dto, req.user.userId);
  }

  @Get()
  list(
    @Req() req: any,
    @Query("status") status?: string,
    @Query("assignedToId") assignedToId?: string,
    @Query("customerId") customerId?: string
  ) {
    const role = req.user?.role as "ADMIN" | "USER";
    const uid = req.user?.userId as string;
    const filters = { status, assignedToId, customerId };
    if (role === "ADMIN") return this.service.listAll(filters);
    return this.service.listForUser(uid, { status, customerId });
  }

  @Get("mine")
  mine(@Req() req: any) {
    return this.service.listForUser(req.user.userId);
  }

  @Patch(":id/complete")
  @UseInterceptors(FileInterceptor("proof", proofUpload))
  complete(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ) {
    const url = file ? `/uploads/${file.filename}` : "";
    return this.service.complete(id, req.user.userId, url);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTaskDto, @Req() req: any) {
    return this.service.update(
      id,
      { id: req.user.userId, role: req.user.role },
      dto
    );
  }

  @Delete(":id")
  @Roles("ADMIN")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
