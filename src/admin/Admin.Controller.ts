import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../user/Roles.Decorator';
import { RolesGuard } from '../user/guards/Roles.Guard';
import { ApproveUserDto } from './dto/ApproveUser.Dto';
import { RejectUserDto } from './dto/RejectUser.Dto';
import { AdminService } from './Admin.Service';
import { Param, Put } from '@nestjs/common';
import { UpdateUserDto } from './dto/UpdateUser.Dto';

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
