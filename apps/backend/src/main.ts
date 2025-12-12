import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const env = process.env.NODE_ENV || 'development';
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret && env === 'production') {
    console.error('[startup] JWT_SECRET is required in non-development environments.');
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3001',
    'https://iperla.netlify.app',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // permite curl/Postman sin Origin
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'), false);
    },
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
