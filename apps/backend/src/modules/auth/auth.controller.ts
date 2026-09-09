import { Body, Controller, Post, Req } from '@nestjs/common';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PASSWORD_REGEX, PASSWORD_RULE_MESSAGE } from '../../common/security';

class LoginDto {
  @IsEmail() email: string;
  // El login no impone la política nueva: las contraseñas antiguas siguen
  // siendo válidas hasta que su dueño las cambie.
  @IsString() @MinLength(6) password: string;
}

class RegisterDto {
  @IsEmail() email: string;
  @IsString() @Matches(PASSWORD_REGEX, { message: PASSWORD_RULE_MESSAGE }) password: string;
  @IsString() name: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private users: UsersService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, req.ip);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) { return this.users.register(dto); }
}

