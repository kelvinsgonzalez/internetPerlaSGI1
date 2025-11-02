import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsString() name: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private users: UsersService) {}

  @Post('login')
  login(@Body() dto: LoginDto) { return this.auth.login(dto.email, dto.password); }

  @Post('register')
  register(@Body() dto: RegisterDto) { return this.users.register(dto); }
}

