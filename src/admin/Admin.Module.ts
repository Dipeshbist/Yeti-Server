import { Module } from '@nestjs/common';
import { NotifyMailModule } from '../email/NotifyMail.Module';
import { RolesGuard } from '../user/guards/Roles.Guard';
import { AdminController } from './Admin.Controller';
import { AdminService } from './Admin.Service';

@Module({
  imports: [NotifyMailModule],
  controllers: [AdminController],
  providers: [AdminService, RolesGuard],
})
export class AdminModule {}
