import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { TbService } from './tb/tb.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { TemperatureAlertRealtimeService } from './alerts/temperature-alert.service';
import { NotifyMailModule } from './email/notifymail.module';
import { DeviceController } from './device/device.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    AdminModule,
    HttpModule,
    NotifyMailModule,
    JwtModule.register({}),
  ],
  controllers: [AppController, DeviceController],
  providers: [TbService, TemperatureAlertRealtimeService],
})
export class AppModule {}
