import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import { Role, User } from '../modules/users/user.entity';

@Injectable()
export class UsersRepository {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}
  findAll() { return this.repo.find(); }
  findById(id: string) { return this.repo.findOne({ where: { id } }); }

  /**
   * Única vía que carga el hash: `passwordHash` es `select: false`.
   * La comparación es insensible a mayúsculas para que no puedan coexistir
   * `Admin@…` y `admin@…` como cuentas distintas.
   */
  findByEmail(email: string) {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('lower(u.email) = lower(:email)', { email })
      .getOne();
  }

  /** Igual que `findByEmail`, pero por id: necesario para verificar la
   *  contraseña actual cuando un usuario cambia la suya. */
  findByIdWithPassword(id: string) {
    return this.repo.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        name: true,
        isBlocked: true,
      },
    });
  }

  save(user: Partial<User>) { return this.repo.save(user); }
  async remove(user: User) { return this.repo.remove(user); }
  count() { return this.repo.count(); }

  /** Administradores activos: evita quedarse sin ningún acceso de admin. */
  countActiveAdmins() {
    return this.repo.count({ where: { role: Role.ADMIN, isBlocked: false } });
  }

  findAllWithLocation() {
    return this.repo.find({
      where: {
        latitude: Not(IsNull()),
        longitude: Not(IsNull()),
      },
    });
  }
}
