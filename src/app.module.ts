import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { TbService } from './tb/Tb.Service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/Auth.Module';
import { AdminModule } from './admin/Admin.Module';

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
