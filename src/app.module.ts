import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { TbService } from './tb/tb.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    AdminModule,
    HttpModule,
    JwtModule.register({}),
  ],
  controllers: [AppController],
  providers: [TbService],
})
export class AppModule {}
