import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { isManager } from "../users/user.entity";
import { AttendanceService } from "./attendance.service";
import { CheckDto, CreateAttendanceDto } from "./dto";

type AuthedRequest = {
  user: { userId: string; email: string; name?: string; role: string };
};

@UseGuards(AuthGuard("jwt"))
@Controller("attendance")
export class AttendanceController {
  constructor(private service: AttendanceService) {}

  @Get() list() {
    return this.service.list();
  }

  @Post() create(@Body() dto: CreateAttendanceDto, @Req() req: AuthedRequest) {
    return this.service.register(dto, req.user.userId);
  }

  @Post("check") check(@Body() dto: CheckDto, @Req() req: AuthedRequest) {
    const displayName = req.user.name || req.user.email;
    return this.service.check(dto, displayName);
  }

  @Get("summary") summary(@Req() req: AuthedRequest, @Query("name") name?: string) {
    // ADMIN y SUPERVISOR pueden consultar a cualquiera; el resto sólo su propio resumen.
    const own = req.user.name || req.user.email;
    const target = isManager(req.user.role) ? name || own : own;
    if (!target) throw new BadRequestException("name is required");
    return this.service.summary(target);
  }
}
