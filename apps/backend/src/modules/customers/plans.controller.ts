import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { Role } from "../users/user.entity";
import { PlansService } from "./plans.service";

@Controller("plans")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class PlansController {
  constructor(private service: PlansService) {}

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.service.findAll();
  }
}
