import { Body, Controller, HttpException, Post, Req } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { clientInfo } from '../audit/audit.interceptor';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail() email: string;
  // El login no impone la política nueva: las contraseñas antiguas siguen
  // siendo válidas hasta que su dueño las cambie.
  @IsString() @MinLength(6) password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private audit: AuditService) {}

  // El interceptor de auditoría omite esta ruta: aquí se registra el resultado
  // con el correo intentado, que es lo útil para detectar ataques.
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const base = { module: 'auth', method: 'POST', path: 'auth/login', ...clientInfo(req) };
    try {
      const result = await this.auth.login(dto.email, dto.password, req.ip);
      const u = result.user;
      void this.audit.record({
        ...base,
        actor: { userId: u.sub, email: u.email, name: u.name, role: u.role },
        action: 'LOGIN',
        statusCode: 201,
        success: true,
      });
      return result;
    } catch (err) {
      void this.audit.record({
        ...base,
        actor: { email: dto.email.trim().toLowerCase() },
        action: 'LOGIN_FALLIDO',
        statusCode: err instanceof HttpException ? err.getStatus() : 500,
        success: false,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  // No hay registro público: sólo un ADMIN crea cuentas (POST /users).
}
