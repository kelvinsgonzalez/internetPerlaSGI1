import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { getAllowedOrigins } from './common/cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Detrás de Traefik la IP de origen llega en X-Forwarded-For. Sin esto,
  // `req.ip` sería siempre la del proxy y el freno de fuerza bruta castigaría a
  // todos los usuarios por igual en lugar de al atacante.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.enableCors({
    origin: getAllowedOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT || 3000;
  await app.listen(port as number);
  console.log(`InternetPerla backend on :${port}`);
}

bootstrap();
