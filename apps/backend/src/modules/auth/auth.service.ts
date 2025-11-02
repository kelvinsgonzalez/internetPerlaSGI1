import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { AttendanceRepository } from '../../repositories/attendance.repository';
import { AttendanceType } from '../../common/enums';

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService, private attendance: AttendanceRepository) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
  if (user.isBlocked) throw new UnauthorizedException('Cuenta bloqueada');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const payload = { sub: user.id, email: user.email, role: user.role, name: user.name };
    // Auto-asistencia: primer login del día para usuarios (trabajadores)
    if ((user as any).role === 'USER') {
      const displayName = user.name || user.email;
      const already = await this.attendance.hasInForToday(displayName);
      if (!already) {
        await this.attendance.save({ name: displayName, tipo: AttendanceType.IN, note: 'auto-login' });
      }
    }
    return { access_token: await this.jwt.signAsync(payload), user: payload };
  }
}

