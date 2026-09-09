import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { isRetiredEmail } from '../../common/security';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService, private users: UsersService) {
    const secret = cfg.get<string>('JWT_SECRET');
    // Sin secreto no hay firma que verificar: es preferible no arrancar a
    // arrancar sin autenticación real. En producción se exige además longitud
    // suficiente, porque un secreto corto se rompe por fuerza bruta y permite
    // fabricar tokens de administrador.
    if (!secret) throw new Error('JWT_SECRET no está definido');
    if (process.env.NODE_ENV === 'production' && secret.length < 32) {
      throw new Error('JWT_SECRET demasiado corto: usa 32+ caracteres (openssl rand -hex 32)');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * La firma válida ya no basta: se contrasta con el estado actual del usuario.
   * Antes, un token robado seguía funcionando hasta 7 días aunque se bloqueara
   * la cuenta o se cambiara la contraseña.
   */
  async validate(payload: any) {
    const user = await this.users.findOne(payload.sub).catch(() => null);
    if (!user) throw new UnauthorizedException('Sesión no válida');
    if (user.isBlocked) throw new UnauthorizedException('Cuenta bloqueada');
    if (isRetiredEmail(user.email)) throw new UnauthorizedException('Cuenta dada de baja');

    // `iat` viene en segundos; se resta un segundo de margen por el redondeo.
    if (user.passwordChangedAt && payload.iat) {
      const changedAtSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (payload.iat < changedAtSeconds - 1) {
        throw new UnauthorizedException('La contraseña cambió: inicia sesión de nuevo');
      }
    }

    // El rol y el nombre se leen de la base, no del token: un cambio de rol
    // surte efecto de inmediato en lugar de esperar a que caduque el JWT.
    return { userId: user.id, email: user.email, role: user.role, name: user.name };
  }
}
