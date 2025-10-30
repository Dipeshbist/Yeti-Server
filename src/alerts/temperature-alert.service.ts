/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/alerts/temperature-alert-realtime.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TbService } from '../tb/tb.service';
import { NotifyMailService } from '../email/notifymail.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class TemperatureAlertRealtimeService implements OnModuleInit {
  private readonly log = new Logger(TemperatureAlertRealtimeService.name);
  private readonly THRESHOLD = 80;
  private readonly subscribedDevices: Set<string> = new Set();
y
  constructor(
    private readonly tb: TbService,
    private readonly mailer: NotifyMailService,
    private readonly db: DatabaseService,
  ) {}

  async onModuleInit() {
    // When the app starts, subscribe to all active devices
    this.log.log('🌡️ Starting real-time temperature alert listener...');
    await this.subscribeToAllDevices();
  }

  private async subscribeToAllDevices() {
    try {
      const devicePage = await this.tb.getAllDevices({
        pageSize: 100,
        page: 0,
      });
      const devices = devicePage?.data ?? [];
      this.log.log(
        `Subscribing to ${devices.length} devices for real-time monitoring`,
      );

      for (const dev of devices) {
        const deviceId = dev.id?.id;
        if (!deviceId || this.subscribedDevices.has(deviceId)) continue;

        this.subscribedDevices.add(deviceId);

        await this.tb.openLiveWs(deviceId, async (key, ts, value) => {
          try {
            const lower = key.toLowerCase();
            if (lower.includes('temp')) {
              const temperature = Number(value);
              if (!isNaN(temperature) && temperature > this.THRESHOLD) {
                this.log.warn(
                  `🔥 ${dev.name}: ${temperature.toFixed(1)}°C exceeded threshold`,
                );

                // Find users linked to this device’s customerId
                const customerId = dev.customerId?.id;
                if (!customerId) return;

                const users = await this.db.user.findMany({
                  where: { customerId, status: 'VERIFIED', isActive: true },
                  select: { email: true, firstName: true },
                });

                for (const u of users) {
                  await this.mailer.notifyTemperatureAlert({
                    email: u.email,
                    deviceName: dev.name,
                    measured: temperature,
                    threshold: this.THRESHOLD,
                    when: new Date(ts).toLocaleString(),
                  });
                }
              }
            }
          } catch (e) {
            this.log.error(`Alert processing error for ${dev.name}:`, e);
          }
        });
      }
    } catch (error) {
      this.log.error('Error while subscribing to devices', error);
    }
  }
}
