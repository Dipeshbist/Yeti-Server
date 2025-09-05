import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { TbService } from './Tb.Service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [TbService],
  exports: [TbService],
})
export class TbModule {}
