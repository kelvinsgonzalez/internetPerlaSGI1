import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { Role } from './user.entity';

@Controller('public/users')
export class PublicUsersController {
  constructor(private service: UsersService) {}

  @Post('bootstrap-admin')
  async bootstrapAdmin(@Body() body: { email: string }) {
    const hasAdmin = (await this.service.findAll()).some(u => u.role === Role.ADMIN);
    if (hasAdmin) throw new BadRequestException('Admin already exists');
    const user = await this.service.findByEmail(body.email);
    if (!user) throw new BadRequestException('User not found');
    await this.service.update(user.id, { role: Role.ADMIN });
    return { promoted: true };
  }
}

