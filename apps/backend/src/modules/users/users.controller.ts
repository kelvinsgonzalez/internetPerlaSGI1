import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, BadRequestException, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, RegisterDto, UpdateUserDto, UpdateLocationDto } from './dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from './user.entity';
import { Request } from 'express';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private service: UsersService) {}

  @Patch('update-location')
  @UseGuards(AuthGuard('jwt'))
  updateLocation(@Body() dto: UpdateLocationDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.updateLocation(req.user.userId, dto.latitude, dto.longitude);
  }

  @Post('register')
  @UseGuards() // public endpoint (no guards)
  async register(@Body() dto: RegisterDto) { return this.service.register(dto); }

  @Post('bootstrap-admin')
  @UseGuards() // public, pero controlado por regla de que no exista un ADMIN
  async bootstrapAdmin(@Body() body: { email: string }) {
    const hasAdmin = (await this.service.findAll()).some(u => u.role === Role.ADMIN);
    if (hasAdmin) throw new BadRequestException('Admin already exists');
    const user = await this.service.findByEmail(body.email);
    if (!user) throw new BadRequestException('User not found');
    await this.service.update(user.id, { role: Role.ADMIN });
    return { promoted: true };
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
