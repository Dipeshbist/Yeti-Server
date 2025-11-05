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

  @Post(':deviceId/location')
  @UseGuards(JwtAuthGuard)
  async saveLocation(
    @Param('deviceId') deviceId: string,
    @Body() body: { location: string; lat?: number; lng?: number },
    @Req() req,
  ) {
    const { location, lat, lng } = body || {};
    if (
      !location?.trim() ||
      typeof lat !== 'number' ||
      typeof lng !== 'number'
    ) {
      throw new BadRequestException('location, lat and lng are required');
    }

    const deviceInfo = await this.tb.getDeviceInfo(deviceId);
    if (!deviceInfo)
      throw new BadRequestException('Device not found in ThingsBoard');

    if (
      req.user.role !== 'admin' &&
      deviceInfo.customerId?.id !== req.user.customerId
    ) {
      throw new UnauthorizedException('Access denied to this device');
    }

    const name = deviceInfo.name ?? 'Unnamed Device';
    const customerId = deviceInfo.customerId?.id ?? null;

    const record = await this.db.device.upsert({
      where: { id: deviceId },
      update: { location, lat, lng },
      create: { id: deviceId, name, customerId, location, lat, lng },
    });

    return { success: true, message: 'Location saved', device: record };
  }

  @Get(':deviceId/location')
  @UseGuards(JwtAuthGuard)
  async getLocation(@Param('deviceId') deviceId: string) {
    const device = await this.db.device.findUnique({
      where: { id: deviceId },
      select: { id: true, location: true, lat: true, lng: true },
    });
    return {
      success: true,
      location: device?.location ?? null,
      lat: device?.lat ?? null,
      lng: device?.lng ?? null,
    };
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
