import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  console.log('🔧 Environment Variables Check:');
  console.log('PORT:', process.env.PORT || '8080 (default)');

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    // origin: true, // Allow all origins - DEVELOPMENT ONLY
    origin: ['http://localhost:5143', 'https://yeti.nepaldigital.systems'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT ?? 8000;
  await app.listen(port, '0.0.0.0'); // Allows access from frontend

  console.log(`🚀 Backend server is running on: http://0.0.0.0:${port}`);
  console.log(`📡 Accepting CORS from Trusted Domains only`);
  console.log(`🔌 ThingsBoard URL: ${process.env.TB_BASE_URL}`);
}

bootstrap();
