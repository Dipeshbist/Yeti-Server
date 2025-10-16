import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { TbService } from './tb.service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [TbService],
  exports: [TbService],
})
export class TbModule {}
