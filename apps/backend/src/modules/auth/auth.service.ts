import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { AttendanceRepository } from '../../repositories/attendance.repository';
import { AttendanceType } from '../../common/enums';
import { BruteForceService } from '../../common/brute-force.service';
import { DUMMY_PASSWORD_HASH, isRetiredEmail } from '../../common/security';

/** Intentos fallidos por (IP + correo) antes de bloquear 15 minutos. */
const MAX_ATTEMPTS_PER_ACCOUNT = 5;
/** Techo por IP: frena el rociado de contraseñas contra muchas cuentas. */
const MAX_ATTEMPTS_PER_IP = 20;

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private attendance: AttendanceRepository,
    private bruteForce: BruteForceService,
  ) {}

  async login(email: string, password: string, ip = 'unknown') {
    const normalized = email.trim().toLowerCase();
    const accountKey = `login:${ip}:${normalized}`;
    const ipKey = `login:${ip}`;
    this.bruteForce.assertAllowed(ipKey, MAX_ATTEMPTS_PER_IP);
    this.bruteForce.assertAllowed(accountKey, MAX_ATTEMPTS_PER_ACCOUNT);

    const fail = () => {
      this.bruteForce.registerFailure(accountKey, MAX_ATTEMPTS_PER_ACCOUNT);
      this.bruteForce.registerFailure(ipKey, MAX_ATTEMPTS_PER_IP);
      // Mensaje idéntico en todos los casos: no se revela si el correo existe.
      return new UnauthorizedException('Correo o contraseña incorrectos');
    };

    // El correo de fábrica quedó retirado; no se atiende ni aunque siguiera en
    // la base por una restauración antigua.
    if (isRetiredEmail(normalized)) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw fail();
    }

    const user = await this.users.findByEmail(normalized);
    if (!user) {
      // Se compara igual contra un hash de descarte para que el tiempo de
      // respuesta no delate qué correos están registrados.
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw fail();
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw fail();
    if (user.isBlocked) throw new UnauthorizedException('Cuenta bloqueada');

    this.bruteForce.reset(accountKey);
    this.bruteForce.reset(ipKey);
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

