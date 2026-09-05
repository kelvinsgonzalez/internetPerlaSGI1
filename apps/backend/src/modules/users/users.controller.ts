import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UpdateLocationDto } from './dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from './user.entity';
import { Request } from 'express';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private service: UsersService) {}

  // Cada quien reporta únicamente su propia ubicación: el id sale del JWT.
  @Patch('update-location')
  updateLocation(@Body() dto: UpdateLocationDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.updateLocation(req.user.userId, dto.latitude, dto.longitude);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll() { return this.service.findAll(); }

  @Get('with-location')
  @Roles(Role.ADMIN)
  findAllWithLocation() { return this.service.findAllWithLocation(); }

  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateUserDto) { return this.service.create(dto); }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
