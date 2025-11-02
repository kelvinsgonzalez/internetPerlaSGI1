import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User, Role } from './modules/users/user.entity';
import * as bcrypt from 'bcryptjs';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get<DataSource>(getDataSourceToken());
  const users = ds.getRepository(User);
  const adminEmail = 'admin@example.com';
  let admin = await users.findOne({ where: { email: adminEmail } });
  if (!admin) {
    admin = users.create({ email: adminEmail, passwordHash: await bcrypt.hash('123456', 10), role: Role.ADMIN, name: 'Admin' });
    await users.save(admin);
  }
  let user = await users.findOne({ where: { email: 'user@example.com' } });
  if (!user) {
    user = users.create({ email: 'user@example.com', passwordHash: await bcrypt.hash('123456', 10), role: Role.USER, name: 'Usuario' });
    await users.save(user);
  }
  // eslint-disable-next-line no-console
  console.log('Seed done. Admin: admin@example.com/123456');
  await app.close();
}
run().catch((e) => { console.error(e); process.exit(1); });

