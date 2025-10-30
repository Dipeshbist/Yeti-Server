/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DatabaseService } from '../database/database.service';
import { TbService } from '../tb/tb.service';

@Controller('devices')
export class DeviceController {
  constructor(
    private readonly db: DatabaseService,
    private readonly tb: TbService,
  ) {}

  // ✅ 1️⃣ Save user-entered location (auto-fills name & customerId)
  @UseGuards(JwtAuthGuard)
  @Post(':deviceId/location')
  async saveLocation(
    @Param('deviceId') deviceId: string,
    @Body('location') location: string,
    @Req() req,
  ) {
    if (!location || !location.trim()) {
      throw new BadRequestException('Location cannot be empty');
    }

    // 🧭 fetch device info from ThingsBoard (only for name + customerId)
    const deviceInfo = await this.tb.getDeviceInfo(deviceId);
    if (!deviceInfo)
      throw new BadRequestException('Device not found in ThingsBoard');

    // ✅ Verify user owns this device
    if (
      req.user.role !== 'admin' &&
      deviceInfo.customerId?.id !== req.user.customerId
    ) {
      throw new UnauthorizedException('Access denied to this device');
    }

    // ✅ Extract just the metadata
    const name = deviceInfo.name ?? 'Unnamed Device';
    const customerId = deviceInfo.customerId?.id ?? null;

    // ✅ Create or update (only location comes from user)
    const record = await this.db.device.upsert({
      where: { id: deviceId },
      update: { location },
      create: { id: deviceId, name, customerId, location },
    });

    return { success: true, message: 'Location saved', device: record };
  }

  // ✅ 2️⃣ Fetch saved location
  @UseGuards(JwtAuthGuard)
  @Get(':deviceId/location')
  async getLocation(@Param('deviceId') deviceId: string) {
    const device = await this.db.device.findUnique({
      where: { id: deviceId },
      select: { id: true, location: true },
    });
    return { success: true, location: device?.location ?? null };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':deviceId/rename')
  async renameDevice(
    @Param('deviceId') deviceId: string,
    @Body('newName') newName: string,
    @Req() req,
  ) {
    if (!newName || !newName.trim()) {
      throw new BadRequestException('Device name cannot be empty');
    }

    // Get original device info from TB
    const tbDevice = await this.tb.getDeviceInfo(deviceId);
    if (!tbDevice)
      throw new BadRequestException('Device not found in ThingsBoard');

    // Security check
    if (
      req.user.role !== 'admin' &&
      tbDevice.customerId?.id !== req.user.customerId
    ) {
      throw new UnauthorizedException('Access denied to this device');
    }

    // ✅ Store both TB original and renamed name
    const record = await this.db.device.upsert({
      where: { id: deviceId },
      update: {
        name: newName.trim(),
        tbOriginalName: tbDevice.name,
      },
      create: {
        id: deviceId,
        name: newName.trim(),
        tbOriginalName: tbDevice.name,
        customerId: tbDevice.customerId?.id ?? null,
      },
    });

    return {
      success: true,
      message: `Device renamed successfully`,
      device: record,
    };
  }

  // @UseGuards(JwtAuthGuard)
  // @Get(':deviceId/info')
  // async getMergedDeviceInfo(@Param('deviceId') deviceId: string) {
  //   const tbDevice = await this.tb.getDeviceInfo(deviceId);
  //   if (!tbDevice)
  //     throw new BadRequestException('Device not found in ThingsBoard');

  //   const local = await this.db.device.findUnique({ where: { id: deviceId } });

  //   return {
  //     success: true,
  //     device: {
  //       id: deviceId,
  //       name: local?.name || tbDevice.name, // ✅ show renamed if available
  //       tbName: tbDevice.name,
  //       location: local?.location ?? null,
  //       customerId: tbDevice.customerId?.id,
  //       createdAt: tbDevice.createdTime,
  //       type: tbDevice.type,
  //       deviceProfileName: tbDevice.deviceProfileName,
  //     },
  //   };
  // }

  @UseGuards(JwtAuthGuard)
  @Get(':deviceId/info')
  async getMergedDeviceInfo(@Param('deviceId') deviceId: string, @Req() req) {
    // 1️⃣ Fetch from ThingsBoard
    const tbDevice = await this.tb.getDeviceInfo(deviceId);
    if (!tbDevice) {
      throw new BadRequestException('Device not found in ThingsBoard');
    }

    // 2️⃣ Verify ownership for non-admins
    if (
      req.user.role !== 'admin' &&
      tbDevice.customerId?.id !== req.user.customerId
    ) {
      throw new UnauthorizedException('Access denied to this device');
    }

    // 3️⃣ Fetch local rename and location from your database
    const local = await this.db.device.findUnique({
      where: { id: deviceId },
      select: { name: true, location: true },
    });

    // 4️⃣ ✅ Return FLATTENED response (not nested under “device”)
    return {
      id: deviceId,
      name: local?.name || tbDevice.name || 'Unnamed Device', // renamed wins
      tbName: tbDevice.name,
      type: tbDevice.type,
      customerTitle: tbDevice.customerTitle,
      deviceProfileName: tbDevice.deviceProfileName,
      location: local?.location ?? null,
      createdTime: tbDevice.createdTime,
      active: tbDevice.active,
    };
  }
}
