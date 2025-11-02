import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { Role } from "../users/user.entity";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto";

@Controller("customers")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Place specific routes before parameterized ones to avoid conflicts like /customers/conflicts matching ":id"
  @Get("conflicts")
  @Roles(Role.ADMIN)
  listConflicts() {
    return this.service.listConflicts();
  }

  @Get(":id")
  findOne(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN)
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateCustomerDto
  ) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  remove(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.service.remove(id);
  }

  @Post("import")
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor("file"))
  importCsv(@UploadedFile() file: Express.Multer.File) {
    return this.service.importCsv(file);
  }
}
