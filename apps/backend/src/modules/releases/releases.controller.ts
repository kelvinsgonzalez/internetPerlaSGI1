import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { Role } from "../users/user.entity";
import { CreateReleaseDto, UpdateReleaseDto } from "./dto";
import { ReleasesService } from "./releases.service";

type AuthedRequest = Request & { user: { userId: string; role: string; email: string; name?: string } };

@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("releases")
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  /** Novedades del usuario autenticado, con las no leídas marcadas. */
  @Get()
  mine(@Req() req: AuthedRequest) {
    return this.releases.forUser(req.user.userId, req.user.role);
  }

  @Post("seen")
  markSeen(@Req() req: AuthedRequest) {
    return this.releases.markSeen(req.user.userId);
  }

  @Get("all")
  @Roles(Role.ADMIN)
  listAll() {
    return this.releases.listAll();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateReleaseDto, @Req() req: AuthedRequest) {
    return this.releases.create(dto, req.user.name || req.user.email);
  }

  @Patch(":id")
  @Roles(Role.ADMIN)
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateReleaseDto) {
    return this.releases.update(id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.releases.remove(id);
  }
}
