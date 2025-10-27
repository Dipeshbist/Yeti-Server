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
    origin: [
      'http://localhost:5143',
      'https://www.garud.cloud',
      'https://garud.cloud',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
  });

  const port = process.env.PORT ?? 8000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend server is running on: http://0.0.0.0:${port}`);
  console.log(`📡 Accepting CORS from Trusted Domains only`);
  console.log(`🔌 ThingsBoard URL: ${process.env.TB_BASE_URL}`);
}

bootstrap();
