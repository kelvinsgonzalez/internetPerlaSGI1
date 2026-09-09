import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User, Role } from './modules/users/user.entity';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { BCRYPT_ROUNDS, PASSWORD_REGEX } from './common/security';

/**
 * Crea el administrador principal.
 *
 * Ni el correo ni la contraseña están escritos aquí: el repositorio es público
 * y cualquier credencial versionada es una credencial quemada. Ambos salen del
 * entorno (`.env`, que está en .gitignore):
 *
 *   ADMIN_EMAIL=...            (obligatorio)
 *   SEED_ADMIN_PASSWORD=...    (opcional; si falta se genera una y se imprime)
 *
 * La contraseña sólo es la INICIAL: el admin la cambia desde
 * Ajustes de Administración → Mi cuenta, y ese cambio invalida los tokens
 * emitidos antes.
 */

/** Contraseña aleatoria que cumple la política, con un generador criptográfico. */
function generatePassword(): string {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = lower + upper + digits + symbols;
  const pick = (set: string) => set[randomInt(set.length)];

  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  while (chars.length < 18) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function run() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) {
    throw new Error(
      'Falta ADMIN_EMAIL. Defínelo en el .env (no en el código: este repositorio se versiona).',
    );
  }

  const provided = process.env.SEED_ADMIN_PASSWORD;
  if (provided && !PASSWORD_REGEX.test(provided)) {
    throw new Error(
      'SEED_ADMIN_PASSWORD no cumple la política: 8+ caracteres con mayúscula, minúscula, número y símbolo.',
    );
  }
  const generated = provided ? undefined : generatePassword();
  const adminPassword = provided ?? (generated as string);

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get<DataSource>(getDataSourceToken());
  const users = ds.getRepository(User);

  const existing = await users.findOne({ where: { email: adminEmail } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log('El administrador ya existe: no se toca su contraseña.');
  } else {
    await users.save(
      users.create({
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, BCRYPT_ROUNDS),
        role: Role.ADMIN,
        name: process.env.ADMIN_NAME || 'Administrador',
      }),
    );
    // eslint-disable-next-line no-console
    console.log('Administrador creado.');
    if (generated) {
      // Único momento en que se muestra: no queda guardada en ningún sitio.
      // eslint-disable-next-line no-console
      console.log(`Contraseña inicial generada: ${generated}`);
      // eslint-disable-next-line no-console
      console.log('Anótala ahora y cámbiala al entrar. No se volverá a mostrar.');
    }
  }

  // Colaborador de prueba: NUNCA en producción y siempre con contraseña
  // aleatoria, para que no exista una cuenta de fábrica adivinable.
  if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO_USER === 'true') {
    const demoEmail = process.env.SEED_DEMO_USER_EMAIL?.trim().toLowerCase();
    if (!demoEmail) {
      // eslint-disable-next-line no-console
      console.log('SEED_DEMO_USER=true pero falta SEED_DEMO_USER_EMAIL: se omite.');
    } else if (!(await users.findOne({ where: { email: demoEmail } }))) {
      const demoPassword = generatePassword();
      await users.save(
        users.create({
          email: demoEmail,
          passwordHash: await bcrypt.hash(demoPassword, BCRYPT_ROUNDS),
          role: Role.USER,
          name: 'Usuario de prueba',
        }),
      );
      // eslint-disable-next-line no-console
      console.log(`Colaborador de prueba creado. Contraseña: ${demoPassword}`);
    }
  }

  await app.close();
}
run().catch((e) => { console.error(e.message ?? e); process.exit(1); });
