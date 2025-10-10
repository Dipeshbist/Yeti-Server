import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('🔧 Environment Variables Check:');
  const effectivePort = process.env.PORT ? Number(process.env.PORT) : 8000;
  console.log('PORT:', effectivePort);

  const app = await NestFactory.create(AppModule);

  // Only allow your sites
  const allowedOrigins = new Set([
    'https://www.garud.cloud',
    'https://garud.cloud',
    'http://localhost:5143', // for local dev
  ]);

  app.enableCors({
    // reflect only whitelisted origins
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return cb(null, true); // allow server-to-server, curl, Postman, etc.
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false, // you’re sending JWT via Authorization header
    optionsSuccessStatus: 204, // preflight success code
    maxAge: 86400, // cache preflight 1 day
  });

  await app.listen(effectivePort, '0.0.0.0');
  console.log(
    `🚀 Backend server is running on: http://0.0.0.0:${effectivePort}`,
  );
  console.log(`🔌 ThingsBoard URL: ${process.env.TB_BASE_URL}`);
}
bootstrap();
