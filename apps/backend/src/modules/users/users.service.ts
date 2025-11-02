import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from './user.entity';
import { CreateUserDto, RegisterDto, UpdateUserDto } from './dto';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../../repositories/users.repository';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

@Injectable()
export class UsersService {
  constructor(private repo: UsersRepository, private realtimeGateway: RealtimeGateway) {}

  findAll() { return this.repo.findAll(); }
  async findOne(id: string) {
    const u = await this.repo.findById(id);
    if (!u) throw new NotFoundException('User not found');
    return u;
  }
  findByEmail(email: string) { return this.repo.findByEmail(email); }

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const count = await this.repo.count();
    const u: Partial<User> = { email: dto.email, passwordHash, name: dto.name, role: count === 0 ? 'ADMIN' as any : undefined, isBlocked: false };
    return this.repo.save(u);
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const u: Partial<User> = { email: dto.email, passwordHash, role: dto.role, name: dto.name, isBlocked: dto.isBlocked ?? false };
    return this.repo.save(u);
  }

  async update(id: string, dto: UpdateUserDto) {
    const u = await this.findOne(id);
    if (dto.email) u.email = dto.email;
    if (dto.name) u.name = dto.name;
    if (dto.role) u.role = dto.role;
    if (dto.password) u.passwordHash = await bcrypt.hash(dto.password, 10);
    if (typeof dto.isBlocked === 'boolean') u.isBlocked = dto.isBlocked;
    return this.repo.save(u);
  }

  async remove(id: string) {
    const u = await this.findOne(id);
    await this.repo.remove(u);
    return { deleted: true };
  }

  findAllWithLocation() {
    return this.repo.findAllWithLocation();
  }

  async updateLocation(userId: string, latitude: number, longitude: number) {
    console.log(`Received location update for user ${userId}: ${latitude}, ${longitude}`);
    const user = await this.findOne(userId);
    user.latitude = latitude;
    user.longitude = longitude;
    await this.repo.save(user);
    this.realtimeGateway.handleLocationUpdate(userId, latitude, longitude);
    return { success: true };
  }
}
