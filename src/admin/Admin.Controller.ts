import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../user/roles.decorator';
import { RolesGuard } from '../user/guards/roles.guard';
import { ApproveUserDto } from './dto/approveuser.dto';
import { RejectUserDto } from './dto/rejectuser.dto';
import { AdminService } from './admin.service';
import { Param, Put } from '@nestjs/common';
import { UpdateUserDto } from './dto/updateuser.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('pending') getPending() {
    return this.admin.getPendingUsers();
  }
  @Get('all') getAll() {
    return this.admin.getAllUsers();
  }

  @Post('approve') approve(@Body() dto: ApproveUserDto) {
    return this.admin.approveUser(dto);
  }
  @Post('reject') reject(@Body() dto: RejectUserDto) {
    return this.admin.rejectUser(dto);
  }

  @Put('update/:id')
  updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.admin.updateUser(id, body);
  }
}
