import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import { User } from '../modules/users/user.entity';

@Injectable()
export class UsersRepository {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}
  findAll() { return this.repo.find(); }
  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  findByEmail(email: string) { return this.repo.findOne({ where: { email } }); }
  save(user: Partial<User>) { return this.repo.save(user); }
  async remove(user: User) { return this.repo.remove(user); }
  count() { return this.repo.count(); }

  findAllWithLocation() {
    return this.repo.find({
      where: {
        latitude: Not(IsNull()),
        longitude: Not(IsNull()),
      },
    });
  }
}
