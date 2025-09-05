import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

// Load environment variables BEFORE creating the app
dotenv.config();

async function bootstrap() {
  console.log('🔧 Environment Variables Check:');
  console.log('PORT:', process.env.PORT || '8080 (default)');

  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend running on port 5143
  // app.enableCors({
  //   origin: [
  //     'http://localhost:5143',
  //     'http://[::]:5143', // IPv6 localhost
  //     'http://127.0.0.1:5143', // Explicit IPv4
  //     'http://169.254.239.103:5143', // ADD THIS - your actual IP
  //     /^http:\/\/192\.168\.\d+\.\d+:5143$/, // Allow any 192.168.x.x IP
  //     /^http:\/\/10\.\d+\.\d+\.\d+:5143$/, // Allow any 10.x.x.x IP
  //   ],
  //   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  //   credentials: true,
  //   allowedHeaders: ['Content-Type', 'Authorization'],
  // });

  app.enableCors({
    origin: true, // Allow all origins - DEVELOPMENT ONLY
    // origin: [
    //   'http://localhost:3000',
    //   'http://localhost:5173',
    //   // Add your frontend domain when ready
    // ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT ?? 8000;
  await app.listen(port, '0.0.0.0'); // <-- Keep this

  console.log(`🚀 Backend server is running on: http://0.0.0.0:${port}`);
  console.log(`📡 Accepting CORS from ALL origins`);
  console.log(`🔌 ThingsBoard URL: ${process.env.TB_BASE_URL}`);
}

bootstrap();
