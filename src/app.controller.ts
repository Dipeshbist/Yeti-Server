/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  UnauthorizedException,
  BadRequestException,
  Delete,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TbService } from './tb/tb.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { DatabaseService } from './database/database.service';

@Controller()
export class AppController {
  constructor(
    private tb: TbService,
    private jwtService: JwtService,
    private dbService: DatabaseService,
  ) {}

  @Get()
  getHello(): string {
    return 'Yeti Backend API is running! 🚀';
  }

  // Protected endpoint to get user profile
  // @Get('auth/profile')
  // @UseGuards(JwtAuthGuard)
  // getProfile(@Request() req) {
  //   return {
  //     success: true,
  //     user: req.user,
  //   };
  // }

  // @Get('my-dashboards')
  // @UseGuards(JwtAuthGuard)
  // async getMyDashboards(@Request() req, @Query('page') page?: string) {
  //   const customerId = req.user.customerId;

  //   return this.tb.getCustomerDashboards(customerId, {
  //     page: page ? Number(page) : 0, // Converts "2" to 2, or defaults to 0
  //     pageSize: 10,
  //   });
  // }

  @Get('my-dashboards')
  @UseGuards(JwtAuthGuard)
  async getMyDashboards(@Request() req, @Query('page') page?: string) {
    const { role, customerId } = req.user;

    if (role === 'admin') {
      // ✅ ensure both page & pageSize are provided (or rely on service defaults)
      return this.tb.getAllDashboards({
        page: page ? Number(page) : 0,
        pageSize: 10,
      });
    }

    if (!customerId) {
      throw new BadRequestException('Customer ID missing for this user.');
    }
    return this.tb.getCustomerDashboards(customerId, {
      page: page ? Number(page) : 0,
      pageSize: 10,
    });
  }

  @Get('my-devices')
  @UseGuards(JwtAuthGuard)
  async getMyDevices(@Request() req) {
    if (!req.user || !req.user.customerId) {
      throw new UnauthorizedException('Invalid user context');
    }

    const customerId = req.user.customerId;

    return this.tb.getCustomerDeviceInfos(customerId, {
      page: 0,
      pageSize: 10,
    });
  }

  @Get('admin/users/:userId/dashboards')
  @UseGuards(JwtAuthGuard)
  async getUserDashboards(@Param('userId') userId: string, @Request() req) {
    if (req.user.role !== 'admin')
      throw new UnauthorizedException('Admins only');

    const user = await this.dbService.user.findUnique({
      where: { id: userId },
    });

    // ✅ If the target is an admin with no customerId -> return tenant dashboards
    if (!user?.customerId) {
      if (user?.role === 'admin') {
        return this.tb.getAllDashboards({ pageSize: 10, page: 0 });
      }
      throw new BadRequestException('User has no customerId');
    }

    return this.tb.getCustomerDashboards(user.customerId, {
      pageSize: 10,
      page: 0,
    });
  }

  // Get devices for a specific user (admin only)
  @Get('admin/users/:userId/devices')
  @UseGuards(JwtAuthGuard)
  async getUserDevices(@Param('userId') userId: string, @Request() req) {
    if (req.user.role !== 'admin')
      throw new UnauthorizedException('Admins only');

    const user = await this.dbService.user.findUnique({
      where: { id: userId },
    });

    // ✅ If the target is an admin with no customerId -> return tenant devices
    if (!user?.customerId) {
      if (user?.role === 'admin') {
        return this.tb.getAllDevices({ pageSize: 10, page: 0 });
      }
      throw new BadRequestException('User has no customerId');
    }

    return this.tb.getCustomerDeviceInfos(user.customerId, {
      page: 0,
      pageSize: 10,
    });
  }

  @Get('admin/tenant/dashboards')
  @UseGuards(JwtAuthGuard)
  async getTenantDashboards(@Request() req, @Query('page') page?: string) {
    if (req.user.role !== 'admin')
      throw new UnauthorizedException('Admins only');
    return this.tb.getAllDashboards({
      page: page ? Number(page) : 0,
      pageSize: 10,
    });
  }

  @Get('admin/tenant/devices')
  @UseGuards(JwtAuthGuard)
  async getTenantDevices(@Request() req, @Query('page') page?: string) {
    if (req.user.role !== 'admin')
      throw new UnauthorizedException('Admins only');
    return this.tb.getAllDevices({
      page: page ? Number(page) : 0,
      pageSize: 10,
    });
  }

  // GET /devices/info/:id  → matches Swagger /api/device/info/{id}
  @Get('devices/info/:id')
  @UseGuards(JwtAuthGuard)
  async getInfo(@Param('id') id: string, @Request() req) {
    const deviceInfo = await this.tb.getDeviceInfo(id);

    // Validate device belongs to user's customer
    if (
      req.user.role !== 'admin' &&
      deviceInfo.customerId?.id !== req.user.customerId
    ) {
      throw new UnauthorizedException('Access denied to this device');
    }

    return deviceInfo;
  }

  // GET /devices/by-name/:name  → convenience
  @Get('devices/by-name/:name')
  @UseGuards(JwtAuthGuard)
  async byName(@Param('name') name: string, @Request() req) {
    const device = await this.tb.getDeviceByName(name);

    // Get full device info to check ownership
    if (device?.id?.id) {
      const deviceInfo = await this.tb.getDeviceInfo(device.id.id);
      if (
        req.user.role !== 'admin' &&
        deviceInfo.customerId?.id !== req.user.customerId
      ) {
        throw new UnauthorizedException('Access denied to this device');
      }
    }

    return device;
  }

  // GET /devices/:id/latest?keys=voltage,current,power
  @Get('devices/:id/latest')
  @UseGuards(JwtAuthGuard)
  async latest(
    @Param('id') id: string,
    @Query('keys') keys: string,
    @Request() req,
  ) {
    // Verify device ownership first
    const deviceInfo = await this.tb.getDeviceInfo(id);
    if (
      req.user.role !== 'admin' &&
      deviceInfo.customerId?.id !== req.user.customerId
    ) {
      throw new UnauthorizedException('Access denied to this device');
    }

    const keyArray = keys ? keys.split(',') : [];
    return this.tb.getLatestTelemetry(id, keyArray);
  }

  // GET /devices/:id/timeseries?keys=power&startTs=...&endTs=...&limit=1000
  @Get('devices/:id/timeseries')
  @UseGuards(JwtAuthGuard)
  async timeseries(
    @Param('id') id: string,
    @Request() req,
    @Query('keys') keys: string,
    @Query('startTs') startTs: string,
    @Query('endTs') endTs: string,
    @Query('limit') limit?: string,
  ) {
    // Verify device ownership
    const deviceInfo = await this.tb.getDeviceInfo(id);
    if (
      req.user.role !== 'admin' &&
      deviceInfo.customerId?.id !== req.user.customerId
    ) {
      throw new UnauthorizedException('Access denied to this device');
    }

    const keyArray = keys ? keys.split(',') : [];
    return this.tb.getTimeseries(
      id,
      keyArray,
      Number(startTs),
      Number(endTs),
      Number(limit) || 1000,
    );
  }

  @Get('devices/by-ids')
  @UseGuards(JwtAuthGuard)
  byIds(@Query('ids') ids: string) {
    const list = (ids ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean); // Remove empty strings
    return this.tb.getDevicesByIds(list);
  }

  // List dashboards assigned to a customer
  @Get('customers/:customerId/dashboards')
  @UseGuards(JwtAuthGuard)
  getCustomerDashboards(
    @Param('customerId') customerId: string,
    @Request() req,
    @Query('pageSize') pageSize?: string,
    @Query('page') page?: string,
    @Query('mobile') mobile?: string,
    @Query('textSearch') textSearch?: string,
    @Query('sortProperty') sortProperty?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    // Verify user can access this customer
    if (customerId !== req.user.customerId) {
      throw new UnauthorizedException('Access denied to this customer');
    }

    return this.tb.getCustomerDashboards(customerId, {
      pageSize: pageSize ? Number(pageSize) : undefined,
      page: page ? Number(page) : undefined,
      mobile: mobile != null ? mobile === 'true' : undefined,
      textSearch,
      sortProperty,
      sortOrder,
    });
  }

  // List device infos under a customer (paginated/filterable)
  @Get('customers/:customerId/device-infos')
  @UseGuards(JwtAuthGuard)
  getCustomerDeviceInfos(
    @Param('customerId') customerId: string,
    @Request() req,
    @Query('pageSize') pageSize?: string,
    @Query('page') page?: string,
    @Query('type') type?: string,
    @Query('deviceProfileId') deviceProfileId?: string,
    @Query('active') active?: string,
    @Query('textSearch') textSearch?: string,
    @Query('sortProperty') sortProperty?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    if (customerId !== req.user.customerId) {
      throw new UnauthorizedException('Access denied to this customer');
    }

    return this.tb.getCustomerDeviceInfos(customerId, {
      pageSize: pageSize ? Number(pageSize) : 10,
      page: page ? Number(page) : 0,
      type,
      deviceProfileId,
      active: typeof active === 'string' ? active === 'true' : undefined,
      textSearch,
      sortProperty,
      sortOrder,
    });
  }

  // Bonus: Get dashboards for a specific device
  @Get('devices/:deviceId/customer-dashboards')
  @UseGuards(JwtAuthGuard)
  async dashboardsForDevice(
    @Param('deviceId') deviceId: string,
    @Request() req,
  ) {
    const info = await this.tb.getDeviceInfo(deviceId);

    // Verify ownership
    if (info?.customerId?.id !== req.user.customerId) {
      throw new UnauthorizedException('Access denied to this device');
    }

    const customerId = info?.customerId?.id;
    if (!customerId)
      return { data: [], totalPages: 0, totalElements: 0, hasNext: false };
    return this.tb.getCustomerDashboards(customerId, { pageSize: 10, page: 0 });
  }

  // Get real-time device data
  @Get('devices/:deviceId/realtime')
  @UseGuards(JwtAuthGuard)
  async getRealtimeData(
    @Param('deviceId') deviceId: string,
    @Query('keys') keys?: string,
    @Request() req?,
  ) {
    // Verify device ownership
    const deviceInfo = await this.tb.getDeviceInfo(deviceId);
    if (
      req.user.role !== 'admin' &&
      deviceInfo.customerId?.id !== req.user.customerId
    ) {
      throw new UnauthorizedException('Access denied to this device');
    }

    // --- ONLINE CHECK: lastActivityTime must be recent (<= 10s) ---
    const attrs = await this.tb.getDeviceAttributes(deviceId, 'SERVER_SCOPE');
    const last = Array.isArray(attrs)
      ? attrs.find((a: any) => a.key === 'lastActivityTime')
      : null;
    const now = Date.now();
    const lastTs = last ? Number(last.value) : 0;
    const isOnline = !!lastTs && now - lastTs <= 10_000;

    // If offline, return empty telemetry immediately
    if (!isOnline) {
      return {
        deviceId,
        timestamp: now,
        telemetry: {}, // ⛔ empty
        attributes: attrs ?? {},
        keys: [],
        customer: req.user.customerId,
      };
    }

    // Build key list (if still online)
    let keyArray: string[] = [];
    if (keys && keys.trim()) {
      keyArray = keys.split(',').filter(Boolean);
    } else {
      try {
        const availableKeys = await this.tb.getDeviceTelemetryKeys(deviceId);
        keyArray = availableKeys || [];
      } catch {
        keyArray = [];
      }
    }

    const telemetry = await this.tb.getLatestTelemetryValues(
      deviceId,
      keyArray,
    );

    return {
      deviceId,
      timestamp: Date.now(),
      telemetry,
      attributes: attrs ?? {},
      keys: keyArray,
      customer: req.user.customerId,
    };
  }

  // Get historical data with time range
  @Get('devices/:deviceId/history')
  @UseGuards(JwtAuthGuard)
  async getHistoricalData(
    @Param('deviceId') deviceId: string,
    @Query('keys') keys?: string,
    @Query('hours') hours: string = '24',
    @Query('limit') limit: string = '1000',
    @Request() req?,
  ) {
    // Verify device ownership (admins bypass)
    const deviceInfo = await this.tb.getDeviceInfo(deviceId);
    if (
      req.user.role !== 'admin' &&
      deviceInfo.customerId?.id !== req.user.customerId
    ) {
      throw new UnauthorizedException('Access denied to this device');
    }

    // Build the key list
    let keyArray: string[] = [];
    if (keys && keys.trim()) {
      keyArray = keys
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      try {
        const availableKeys = await this.tb.getDeviceTelemetryKeys(deviceId);
        keyArray = (availableKeys ?? [])
          .map((s: string) => String(s).trim())
          .filter(Boolean);
      } catch (error) {
        console.error(
          'Failed to get telemetry keys for device:',
          deviceId,
          error,
        );
        keyArray = [];
      }
    }

    const hoursNum = Number.isFinite(parseInt(hours)) ? parseInt(hours) : 24;
    const limitNum = Number.isFinite(parseInt(limit)) ? parseInt(limit) : 1000;

    const endTs = Date.now();
    const startTs = endTs - hoursNum * 60 * 60 * 1000;

    // ✅ Guard: if no keys, don't call TB (prevents 500 from ?keys=)
    if (!keyArray.length) {
      return {
        deviceId,
        timeRange: {
          start: new Date(startTs).toISOString(),
          end: new Date(endTs).toISOString(),
          hours: hoursNum,
        },
        data: {},
        totalPoints: 0,
        keys: [],
        customer: req.user.customerId,
        note: 'No telemetry keys available for this device.',
      };
    }

    try {
      const data = await this.tb.getHistoricalTelemetry(
        deviceId,
        keyArray,
        startTs,
        endTs,
        limitNum,
      );

      return {
        deviceId,
        timeRange: {
          start: new Date(startTs).toISOString(),
          end: new Date(endTs).toISOString(),
          hours: hoursNum,
        },
        data,
        totalPoints: Object.values(data).reduce(
          (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
          0,
        ),
        keys: keyArray,
        customer: req.user.customerId,
      };
    } catch (error) {
      console.error('Failed to get historical telemetry:', error);
      return {
        deviceId,
        timeRange: {
          start: new Date(startTs).toISOString(),
          end: new Date(endTs).toISOString(),
          hours: hoursNum,
        },
        data: {},
        totalPoints: 0,
        keys: keyArray,
        error: 'Failed to fetch historical data',
      };
    }
  }

  // Get device info with all available data
  @Get('devices/:deviceId/complete')
  @UseGuards(JwtAuthGuard)
  async getCompleteDeviceData(
    @Param('deviceId') deviceId: string,
    @Request() req,
  ) {
    // Verify ownership first
    const deviceInfo = await this.tb.getDeviceInfo(deviceId);
    if (
      req.user.role !== 'admin' &&
      deviceInfo.customerId?.id !== req.user.customerId
    ) {
      throw new UnauthorizedException('Access denied to this device');
    }
    try {
      const [deviceInfo, telemetryKeys, attributeKeys] = await Promise.all([
        this.tb.getDeviceInfo(deviceId),
        this.tb.getDeviceTelemetryKeys(deviceId),
        this.tb.getDeviceAttributeKeys(deviceId),
      ]);

      const [latestTelemetry, attributes] = await Promise.all([
        telemetryKeys && telemetryKeys.length > 0
          ? this.tb.getLatestTelemetryValues(deviceId, telemetryKeys)
          : {},
        this.tb.getDeviceAttributes(deviceId),
      ]);

      return {
        device: deviceInfo,
        telemetry: {
          keys: telemetryKeys || [],
          latest: latestTelemetry,
        },
        attributes: {
          keys: attributeKeys || [],
          current: attributes,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get complete device data:', error);
      return {
        device: null,
        telemetry: { keys: [], latest: {} },
        attributes: { keys: [], current: {} },
        timestamp: new Date().toISOString(),
        error: 'Failed to fetch complete device data',
      };
    }
  }

  // Get live data stream (polling endpoint)
  @Get('devices/:deviceId/live')
  @UseGuards(JwtAuthGuard)
  async getLiveData(
    @Param('deviceId') deviceId: string,
    @Query('keys') keys?: string,
    @Query('maxAge') maxAge: string = '30',
    @Request() req?,
  ) {
    // Verify device ownership
    const deviceInfo = await this.tb.getDeviceInfo(deviceId);
    if (
      req.user.role !== 'admin' &&
      deviceInfo.customerId?.id !== req.user.customerId
    ) {
      throw new UnauthorizedException('Access denied to this device');
    }
    // Handle undefined or empty keys
    let keyArray: string[] = [];

    if (keys && keys.trim()) {
      keyArray = keys.split(',').filter(Boolean);
    } else {
      try {
        const availableKeys = await this.tb.getDeviceTelemetryKeys(deviceId);
        keyArray = availableKeys || [];
      } catch (error) {
        console.error('Failed to get telemetry keys for live data:', error);
        keyArray = [];
      }
    }

    // ✅ If still empty, DO NOT call TB; return an empty result
    if (!keyArray.length) {
      return {
        deviceId,
        data: {},
        timestamp: Date.now(),
        maxAgeSeconds: parseInt(maxAge),
        dataCount: 0,
        keys: [],
        isLive: false,
      };
    }

    const maxAgeSeconds = parseInt(maxAge);
    const liveTelemetry = await this.tb.getLiveTelemetryValues(
      deviceId,
      keyArray,
      maxAgeSeconds,
    );

    return {
      deviceId,
      data: liveTelemetry,
      timestamp: Date.now(),
      maxAgeSeconds,
      dataCount: Object.keys(liveTelemetry).length,
      keys: keyArray,
      isLive: Object.values(liveTelemetry).some((item) => item.isLive),
    };
  }

  @Get('devices/:deviceId/attributes/:scope')
  @UseGuards(JwtAuthGuard)
  async getDeviceAttributes(
    @Param('deviceId') deviceId: string,
    @Param('scope') scope: 'CLIENT_SCOPE' | 'SERVER_SCOPE' | 'SHARED_SCOPE',
    @Request() req,
  ) {
    // Verify device ownership
    const deviceInfo = await this.tb.getDeviceInfo(deviceId);
    if (
      req.user.role !== 'admin' &&
      deviceInfo.customerId?.id !== req.user.customerId
    ) {
      throw new UnauthorizedException('Access denied to this device');
    }

    try {
      const attributes = await this.tb.getDeviceAttributes(deviceId, scope);

      return {
        deviceId,
        scope,
        attributes,
        timestamp: Date.now(),
        customer: req.user.customerId,
      };
    } catch (error) {
      console.error('Failed to get device attributes:', error);
      return {
        deviceId,
        scope,
        attributes: {},
        timestamp: Date.now(),
        error: 'Failed to fetch device attributes',
      };
    }
  }

  @Delete('admin/users/delete/:id')
  @UseGuards(JwtAuthGuard)
  async deleteUser(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'admin')
      throw new UnauthorizedException('Admins only');

    await this.dbService.user.delete({ where: { id } });
    return { success: true, message: 'User deleted successfully' };
  }
}
