import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, User } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './dto';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../../repositories/users.repository';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { BruteForceService } from '../../common/brute-force.service';
import { BCRYPT_ROUNDS, isRetiredEmail } from '../../common/security';

/** Intentos de contraseña actual antes de frenar el cambio de contraseña. */
const MAX_PASSWORD_ATTEMPTS = 5;

@Injectable()
export class UsersService {
  constructor(
    private repo: UsersRepository,
    private realtimeGateway: RealtimeGateway,
    private bruteForce: BruteForceService,
  ) {}

  /** Un correo retirado no puede volver a existir en el sistema. */
  private assertUsableEmail(email?: string) {
    if (isRetiredEmail(email)) {
      throw new ForbiddenException('Ese correo está dado de baja de forma permanente');
    }
  }

  /** Todo correo se guarda normalizado: la unicidad no depende del formato. */
  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  /** El índice único respondería con un 500 genérico; mejor avisar antes. */
  private async assertEmailAvailable(email: string, ownerId?: string) {
    const existing = await this.repo.findByEmail(email);
    if (existing && existing.id !== ownerId) {
      throw new ConflictException('Ese correo ya está en uso por otra cuenta');
    }
  }

  /** Verifica la contraseña actual con freno contra fuerza bruta. */
  private async verifyCurrentPassword(id: string, currentPassword: string) {
    // Sin freno, un token robado permitiría adivinar la contraseña actual a
    // fuerza bruta contra estos mismos endpoints.
    const throttleKey = `password:${id}`;
    this.bruteForce.assertAllowed(throttleKey, MAX_PASSWORD_ATTEMPTS);

    const user = await this.repo.findByIdWithPassword(id);
    if (!user) throw new NotFoundException('User not found');

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      this.bruteForce.registerFailure(throttleKey, MAX_PASSWORD_ATTEMPTS);
      // 400 y no 401: el interceptor del frontend cierra la sesión ante cualquier
      // 401, y aquí el token es válido; lo que falla es la contraseña escrita.
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    this.bruteForce.reset(throttleKey);
    return user;
  }

  findAll() { return this.repo.findAll(); }
  async findOne(id: string) {
    const u = await this.repo.findById(id);
    if (!u) throw new NotFoundException('User not found');
    return u;
  }
  findByEmail(email: string) { return this.repo.findByEmail(email); }

  async create(dto: CreateUserDto) {
    this.assertUsableEmail(dto.email);
    await this.assertEmailAvailable(this.normalizeEmail(dto.email));
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const u: Partial<User> = { email: this.normalizeEmail(dto.email), passwordHash, role: dto.role, name: dto.name, isBlocked: dto.isBlocked ?? false };
    return this.repo.save(u);
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string) {
    this.assertUsableEmail(dto.email);
    const u = await this.findOne(id);

    // Un admin no puede degradarse, bloquearse ni cambiarse la contraseña a sí
    // mismo desde la gestión de colaboradores: para lo propio está
    // `changeOwnPassword`, que exige la contraseña actual. Así, un token robado
    // de un admin no sirve para reescribir su propia credencial.
    if (actorId && actorId === id) {
      if (dto.password) {
        throw new ForbiddenException('Usa el cambio de contraseña de tu propia cuenta');
      }
      if (dto.role && dto.role !== u.role) {
        throw new ForbiddenException('No puedes cambiar tu propio rol');
      }
      if (dto.isBlocked === true) {
        throw new ForbiddenException('No puedes bloquear tu propia cuenta');
      }
    }

    // Nunca dejar el sistema sin un administrador activo.
    const losesAdmin =
      u.role === Role.ADMIN && ((dto.role && dto.role !== Role.ADMIN) || dto.isBlocked === true);
    if (losesAdmin) await this.assertNotLastAdmin();

    if (dto.email) {
      const email = this.normalizeEmail(dto.email);
      if (email !== u.email) await this.assertEmailAvailable(email, u.id);
      u.email = email;
    }
    if (dto.name) u.name = dto.name;
    if (dto.role) u.role = dto.role;
    if (dto.password) {
      u.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      // Restablecer la contraseña de un colaborador cierra sus sesiones activas.
      u.passwordChangedAt = new Date();
    }
    if (typeof dto.isBlocked === 'boolean') u.isBlocked = dto.isBlocked;
    return this.repo.save(u);
  }

  private async assertNotLastAdmin() {
    if ((await this.repo.countActiveAdmins()) <= 1) {
      throw new ForbiddenException('Debe quedar al menos un administrador activo');
    }
  }

  /** El propio usuario (incluido el admin principal) cambia su contraseña. */
  async changeOwnPassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.verifyCurrentPassword(id, currentPassword);
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual');
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    // Invalida los JWT emitidos antes de este momento: si alguien tenía un token
    // robado, cambiar la contraseña lo expulsa de verdad.
    user.passwordChangedAt = new Date();
    await this.repo.save(user);
    return { success: true };
  }

  /** El propio usuario cambia su correo de acceso. */
  async changeOwnEmail(id: string, currentPassword: string, newEmail: string) {
    this.assertUsableEmail(newEmail);
    const user = await this.verifyCurrentPassword(id, currentPassword);
    const email = this.normalizeEmail(newEmail);
    if (email === user.email) {
      throw new BadRequestException('El nuevo correo es igual al actual');
    }
    await this.assertEmailAvailable(email, id);
    user.email = email;
    const saved = await this.repo.save(user);
    return { id: saved.id, email: saved.email };
  }

  async remove(id: string, actorId?: string) {
    if (actorId && actorId === id) {
      throw new ForbiddenException('No puedes eliminar tu propia cuenta');
    }
    const u = await this.findOne(id);
    if (u.role === Role.ADMIN) await this.assertNotLastAdmin();
    await this.repo.remove(u);
    return { deleted: true };
  }

  findAllWithLocation() {
    return this.repo.findAllWithLocation();
  }

  async updateLocation(userId: string, latitude: number, longitude: number) {
    const user = await this.findOne(userId);
    user.latitude = latitude;
    user.longitude = longitude;
    user.locationUpdatedAt = new Date();
    await this.repo.save(user);
    this.realtimeGateway.handleLocationUpdate(userId, latitude, longitude);
    return { success: true };
  }
}
