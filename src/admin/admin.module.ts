import { Module } from '@nestjs/common';
import { NotifyMailModule } from '../email/notifymail.module';
import { RolesGuard } from '../user/guards/roles.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [NotifyMailModule],
  controllers: [AdminController],
  providers: [AdminService, RolesGuard],
})
export class AdminModule {}
