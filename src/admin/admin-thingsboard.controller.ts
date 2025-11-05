/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../user/roles.decorator';
import { RolesGuard } from '../user/guards/roles.guard';
import { TbService } from '../tb/tb.service';

@Controller('admin/thingsboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminThingsboardController {
  private readonly logger = new Logger(AdminThingsboardController.name);

  constructor(private readonly tb: TbService) {}

  // 🧱 Create new customer
  @Post('customers')
  async createCustomer(@Body() body: any) {
    return this.tb.createCustomer(body);
  }

  // 🧱 Create new device
  @Post('devices')
  async createDevice(@Body() body: any) {
    return this.tb.createDevice(body);
  }

  // 🔗 Assign device to a customer
  @Post('customers/:customerId/devices/:deviceId')
  async assignDevice(
    @Param('customerId') customerId: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.tb.assignDeviceToCustomer(customerId, deviceId);
  }

  // 🔗 Unassign device from customer
  @Delete('customers/devices/:deviceId')
  async unassignDevice(@Param('deviceId') deviceId: string) {
    return this.tb.unassignDeviceFromCustomer(deviceId);
  }

  // ❌ Delete device
  @Delete('devices/:deviceId')
  async deleteDevice(@Param('deviceId') deviceId: string) {
    return this.tb.deleteDevice(deviceId);
  }

  // 📋 List tenant devices
  @Get('devices')
  async getAllDevices(
    @Query('pageSize') pageSize = '10',
    @Query('page') page = '0',
  ) {
    return this.tb.getAllDevices({
      pageSize: Number(pageSize),
      page: Number(page),
    });
  }

  @Get('customers')
  async getAllCustomers() {
    return this.tb.getAllCustomers();
  }

  // 📋 List tenant dashboards
  @Get('dashboards')
  async getAllDashboards(
    @Query('pageSize') pageSize = '10',
    @Query('page') page = '0',
  ) {
    return this.tb.getAllDashboards({
      pageSize: Number(pageSize),
      page: Number(page),
    });
  }

  // ❌ Delete customer
  @Delete('customers/:customerId')
  async deleteCustomer(@Param('customerId') customerId: string) {
    return this.tb.deleteCustomer(customerId);
  }

  @Get('device-profiles')
  async getAllDeviceProfiles() {
    return this.tb.getAllDeviceProfiles();
  }

  // 📋 Fetch devices assigned to a customer
  @Get('customers/:customerId/devices')
  async getDevicesForCustomer(
    @Param('customerId') customerId: string,
    @Query('pageSize') pageSize = '100',
    @Query('page') page = '0',
  ) {
    this.logger.log(
      `Fetching devices for customer ${customerId} (pageSize: ${pageSize}, page: ${page})`,
    );

    try {
      const result = await this.tb.getDevicesForCustomer(customerId, {
        pageSize: Number(pageSize),
        page: Number(page),
      });

      this.logger.log(
        `Found ${result.data?.length || 0} devices for customer ${customerId}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error fetching devices for customer ${customerId}: ${error.message}`,
      );
      throw error;
    }
  }
}
