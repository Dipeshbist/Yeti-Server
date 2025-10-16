/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import WebSocket from 'ws';

type TbLoginRes = { token: string; refreshToken: string };

export type PageData<T> = {
  data: T[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
};

export type DashboardInfo = {
  id: { entityType: 'DASHBOARD'; id: string };
  title: string;
  image?: string | null;
  assignedCustomers?: any[];
  mobileHide?: boolean;
  mobileOrder?: number;
};

export type DashboardListParams = {
  pageSize?: number;
  page?: number;
  mobile?: boolean;
  textSearch?: string;
  sortProperty?: 'title' | 'createdTime' | string;
  sortOrder?: 'ASC' | 'DESC';
};

export type DeviceInfo = {
  id: { entityType: 'DEVICE'; id: string };
  name: string;
  type: string;
  label?: string | null;
  deviceProfileName: string;
  customerTitle?: string | null;
  active?: boolean;
  createdTime?: number;
};

export type DeviceInfoQuery = {
  pageSize?: number;
  page?: number;
  type?: string;
  deviceProfileId?: string;
  active?: boolean;
  textSearch?: string;
  sortProperty?: string;
  sortOrder?: 'ASC' | 'DESC';
};

@Injectable()
export class TbService {
  private readonly log = new Logger(TbService.name);
  private jwt: string | null = null; // Stores the authentication token from ThingsBoard: initially null
  private jwtExpMs = 0; // Stores when the JWT token expires (in milliseconds): intially 0

  constructor(private http: HttpService) {
    // Validate required environment variables
    const requiredVars = ['TB_BASE_URL', 'TB_USERNAME', 'TB_PASSWORD'];
    const missing = requiredVars.filter((varName) => !process.env[varName]); //Check Which environment variables Are Missing

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`,
      );
    }

    this.log.log('TbService initialized with valid environment variables');
  }

  private base() {
    return process.env.TB_BASE_URL!;
  }

  // ---- AUTH (user login to get JWT) ----
  private async login() {
    const url = `${this.base()}/api/auth/login`;
    const body = {
      username: process.env.TB_USERNAME,
      password: process.env.TB_PASSWORD,
    };
    const { data } = await firstValueFrom(
      this.http.post<TbLoginRes>(url, body),
    );
    this.jwt = data.token;
    const payload = JSON.parse(
      Buffer.from(data.token.split('.')[1], 'base64').toString(),
    );
    this.jwtExpMs = payload.exp * 1000;
    this.log.log(
      `TB login ok, JWT exp ${new Date(this.jwtExpMs).toISOString()}`,
    );
  }

  private async ensureJwt(): Promise<string> {
    if (!this.jwt || Date.now() > this.jwtExpMs - 60_000) {
      await this.login();
    }
    return this.jwt!;
  }

  private async authHeaders() {
    const token = await this.ensureJwt();
    return { Authorization: `Bearer ${token}` };
  }

  // ---- DEVICE INFO ----
  // Matches the Swagger you showed: GET /api/device/info/{deviceId}
  async getDeviceInfo(deviceId: string) {
    const url = `${this.base()}/api/device/info/${deviceId}`;
    const { data } = await firstValueFrom(
      this.http.get(url, { headers: await this.authHeaders() }),
    );
    return data; // device name, profile, customer, etc.
  }

  async getDeviceByName(name: string) {
    const url = `${this.base()}/api/tenant/devices?deviceName=${encodeURIComponent(name)}`;
    const { data } = await firstValueFrom(
      this.http.get(url, { headers: await this.authHeaders() }),
    );
    return data as { id: { id: string }; name: string; type: string };
  }

  async getDeviceInfoForCustomer(deviceId: string, customerId: string) {
    const deviceInfo = await this.getDeviceInfo(deviceId);

    if (!deviceInfo.customerId?.id || deviceInfo.customerId.id !== customerId) {
      throw new Error('Device not found or access denied');
    }

    return deviceInfo;
  }

  // Add/replace this
  async getAllDashboards(params: DashboardListParams = {}) {
    const pageSize = params.pageSize ?? 10;
    const page = params.page ?? 0; // ✅ ensure page is present

    const qs = new URLSearchParams();
    qs.set('pageSize', String(pageSize));
    qs.set('page', String(page));

    const url = `${this.base()}/api/tenant/dashboards?${qs.toString()}`;

    // Optional: log for debugging
    // this.log.debug(`TB getAllDashboards -> ${url}`);

    const { data } = await firstValueFrom(
      this.http.get(url, { headers: await this.authHeaders() }),
    );
    return data;
  }

  async getAllDevices(params: DeviceInfoQuery = {}) {
    const pageSize = params.pageSize ?? 10;
    const page = params.page ?? 0;

    const qs = new URLSearchParams();
    qs.set('pageSize', String(pageSize));
    qs.set('page', String(page));

    const url = `${this.base()}/api/tenant/deviceInfos?${qs.toString()}`;
    const { data } = await firstValueFrom(
      this.http.get(url, { headers: await this.authHeaders() }),
    );
    return data;
  }

  // ---- TELEMETRY (latest + time-series) ----
  async getLatestTelemetry(deviceId: string, keys: string[]) {
    // ✅ Guard
    // if (!keys || !keys.length) {
    //   this.log.warn(
    //     `Skipping latest telemetry fetch for ${deviceId}: empty keys`,
    //   );
    //   return {};
    // }
    const url = `${this.base()}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${keys.join(',')}&limit=1&useStrictDataTypes=true`;
    const { data } = await firstValueFrom(
      this.http.get(url, { headers: await this.authHeaders() }),
    );
    // Convert TB shape to { key: {ts,value} | null }
    const out: Record<string, { ts: number; value: unknown } | null> = {};
    for (const k of keys) {
      const arr = data[k] as { ts: number; value: string }[] | undefined;
      out[k] = arr?.length
        ? { ts: +arr[0].ts, value: this.cast(arr[0].value) }
        : null;
    }
    return out;
  }

  async getTimeseries(
    deviceId: string,
    keys: string[],
    startTs: number,
    endTs: number,
    limit = 1000,
  ) {
    // ✅ Guard
    if (!keys || !keys.length) {
      this.log.warn(`Skipping timeseries fetch for ${deviceId}: empty keys`);
      return {};
    }
    const url = `${this.base()}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${keys.join(',')}&startTs=${startTs}&endTs=${endTs}&limit=${limit}&useStrictDataTypes=true`;
    const { data } = await firstValueFrom(
      this.http.get(url, { headers: await this.authHeaders() }),
    );
    const out: Record<string, { ts: number; value: unknown }[]> = {};
    for (const [k, arr] of Object.entries<any>(data)) {
      out[k] = (arr as any[]).map((p) => ({
        ts: +p.ts,
        value: this.cast(p.value),
      }));
    }
    return out;
  }

  // ---- LIVE (optional): TB WebSocket telemetry ----
  async openLiveWs(
    deviceId: string,
    onData: (key: string, ts: number, value: unknown) => void,
  ): Promise<WebSocket> {
    const token = await this.ensureJwt();
    const wsUrl =
      this.base().replace(/^http/, 'ws') +
      `/api/ws/plugins/telemetry?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      const sub = {
        tsSubCmds: [
          {
            entityType: 'DEVICE',
            entityId: deviceId,
            scope: 'LATEST_TELEMETRY',
            cmdId: 1,
          },
        ],
        historyCmds: [],
        attrSubCmds: [],
      };
      ws.send(JSON.stringify(sub));
      this.log.log(`WS open; subscribed latest telemetry for ${deviceId}`);
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.data) {
          for (const [key, pairs] of Object.entries<any>(msg.data)) {
            for (const [ts, val] of pairs as [number, unknown][]) {
              onData(key, Number(ts), this.cast(val));
            }
          }
        }
      } catch (e) {
        this.log.error(`WS parse error: ${(e as Error).message}`);
      }
    });
    ws.on('error', (e) =>
      this.log.error(`TB WS error: ${(e as Error).message}`),
    );
    ws.on('close', () => this.log.warn('TB WS closed'));
    return ws;
  }

  private cast(v: unknown) {
    if (typeof v !== 'string') return v;
    if (v === 'true') return true;
    if (v === 'false') return false;
    const n = Number(v);
    return Number.isNaN(n) ? v : n;
  }

  async getDevicesByIds(ids: string[]) {
    if (!ids.length) return [];
    // sanitize & build CSV
    const csv = ids
      .map((s) => (s || '').trim())
      .filter(Boolean)
      .join(',');
    const url = `${this.base()}/api/devices?deviceIds=${encodeURIComponent(csv)}`;
    const { data } = await firstValueFrom(
      this.http.get(url, { headers: await this.authHeaders() }),
    );
    return data as Array<{
      id: { entityType: 'DEVICE'; id: string };
      name: string;
      type: string;
      deviceProfileName: string;
      // ... (TB returns more fields; keep as needed)
    }>;
  }

  async getCustomerDashboards(
    customerId: string,
    params: DashboardListParams = {},
  ): Promise<PageData<DashboardInfo>> {
    const qs = new URLSearchParams();
    if (params.pageSize != null) qs.set('pageSize', String(params.pageSize));
    if (params.page != null) qs.set('page', String(params.page));
    if (params.mobile != null) qs.set('mobile', String(params.mobile));
    if (params.textSearch) qs.set('textSearch', params.textSearch);
    if (params.sortProperty) qs.set('sortProperty', params.sortProperty);
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder);

    const url = `${this.base()}/api/customer/${customerId}/dashboards${qs.toString() ? `?${qs}` : ''}`;
    const { data } = await firstValueFrom(
      this.http.get<PageData<DashboardInfo>>(url, {
        headers: await this.authHeaders(),
      }),
    );
    return data;
  }

  async getCustomerDeviceInfos(
    customerId: string,
    q: DeviceInfoQuery = {},
  ): Promise<PageData<DeviceInfo>> {
    const p = new URLSearchParams();
    p.set('pageSize', String(q.pageSize ?? 10));
    p.set('page', String(q.page ?? 0));
    if (q.type) p.set('type', q.type);
    if (q.deviceProfileId) p.set('deviceProfileId', q.deviceProfileId);
    if (typeof q.active === 'boolean') p.set('active', String(q.active));
    if (q.textSearch) p.set('textSearch', q.textSearch);
    if (q.sortProperty) p.set('sortProperty', q.sortProperty);
    if (q.sortOrder) p.set('sortOrder', q.sortOrder);

    const url = `${this.base()}/api/customer/${customerId}/deviceInfos?${p.toString()}`;
    const { data } = await firstValueFrom(
      this.http.get<PageData<DeviceInfo>>(url, {
        headers: await this.authHeaders(),
      }),
    );
    return data;
  }

  // Get latest telemetry values
  async getLatestTelemetryValues(deviceId: string, keys: string[]) {
    // ✅ Guard
    // if (!keys || !keys.length) {
    //   this.log.warn(
    //     `Skipping latest-timeseries-values for ${deviceId}: empty keys`,
    //   );
    //   return {};
    // }

    const url = `${this.base()}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${keys.join(',')}&useStrictDataTypes=true`;
    const { data } = await firstValueFrom(
      this.http.get(url, { headers: await this.authHeaders() }),
    );

    // Transform to simpler format
    const result: Record<string, { value: any; timestamp: number }> = {};
    for (const [key, values] of Object.entries<any>(data)) {
      if (values && values.length > 0) {
        result[key] = {
          value: this.cast(values[0].value),
          timestamp: values[0].ts,
        };
      }
    }
    return result;
  }

  // Get historical telemetry data
  async getHistoricalTelemetry(
    deviceId: string,
    keys: string[],
    startTs: number,
    endTs: number,
    limit: number = 1000,
  ) {
    // ✅ Guard
    if (!keys || !keys.length) {
      this.log.warn(
        `Skipping historical telemetry fetch for ${deviceId}: empty keys`,
      );
      return {};
    }
    const url = `${this.base()}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
    const params = {
      keys: keys.join(','),
      startTs: startTs.toString(),
      endTs: endTs.toString(),
      limit: limit.toString(),
      useStrictDataTypes: 'true',
    };

    const { data } = await firstValueFrom(
      this.http.get(url, { params, headers: await this.authHeaders() }),
    );

    // Transform data
    const result: Record<string, Array<{ value: any; timestamp: number }>> = {};
    for (const [key, values] of Object.entries<any>(data)) {
      result[key] = values.map((item: any) => ({
        value: this.cast(item.value),
        timestamp: item.ts,
      }));
    }
    return result;
  }

  // Get device attributes
  async getDeviceAttributes(
    deviceId: string,
    scope: 'CLIENT_SCOPE' | 'SERVER_SCOPE' | 'SHARED_SCOPE' = 'CLIENT_SCOPE',
  ) {
    const url = `${this.base()}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/${scope}`;
    const { data } = await firstValueFrom(
      this.http.get(url, { headers: await this.authHeaders() }),
    );
    return data;
  }

  // Get all attribute keys for a device
  async getDeviceAttributeKeys(deviceId: string) {
    const url = `${this.base()}/api/plugins/telemetry/DEVICE/${deviceId}/keys/attributes`;
    const { data } = await firstValueFrom(
      this.http.get(url, { headers: await this.authHeaders() }),
    );
    return data;
  }

  // Get all telemetry keys for a device
  async getDeviceTelemetryKeys(deviceId: string) {
    const url = `${this.base()}/api/plugins/telemetry/DEVICE/${deviceId}/keys/timeseries`;
    const { data } = await firstValueFrom(
      this.http.get(url, { headers: await this.authHeaders() }),
    );
    return data;
  }

  async getCustomerInfo(customerId: string) {
    try {
      const url = `${this.base()}/api/customer/${customerId}`;
      const { data } = await firstValueFrom(
        this.http.get(url, { headers: await this.authHeaders() }),
      );
      return data;
    } catch (error) {
      this.log.error(
        `Failed to get customer info for ${customerId}: ${error.message}`,
      );
      return null;
    }
  }

  // Get only recent telemetry (within specified timeframe)
  async getLiveTelemetryValues(
    deviceId: string,
    keys: string[],
    timeWindowSeconds: number = 30,
  ) {
    if (!keys || !keys.length) {
      this.log.warn(
        `Skipping live telemetry fetch for ${deviceId}: empty keys`,
      );
      return {};
    }

    const now = Date.now();
    const startTs = now - timeWindowSeconds * 1000;

    // --- 1️⃣ Check device's last activity first ---
    const attrUrl = `${this.base()}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`;
    const { data: attrs } = await firstValueFrom(
      this.http.get(attrUrl, { headers: await this.authHeaders() }),
    );

    // Find the ThingsBoard-provided "lastActivityTime" attribute
    const lastActivity = Array.isArray(attrs)
      ? attrs.find((a: any) => a.key === 'lastActivityTime')
      : null;

    const lastActiveTs = lastActivity ? Number(lastActivity.value) : 0;
    const isOnlineDevice = !!lastActiveTs && now - lastActiveTs <= 10_000; // <=10 s → online

    if (!isOnlineDevice) {
      this.log.log(
        `Device ${deviceId} considered offline (last active ${(
          (now - lastActiveTs) /
          1000
        ).toFixed(1)}s ago) – returning empty telemetry.`,
      );
      return {}; // ⛔ do not even query telemetry
    }

    // --- 2️⃣ Fetch telemetry only for online devices ---
    const url = `${this.base()}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
    const params = {
      keys: keys.join(','),
      startTs: startTs.toString(),
      endTs: now.toString(),
      limit: '1',
      useStrictDataTypes: 'true',
    };

    const { data } = await firstValueFrom(
      this.http.get(url, { params, headers: await this.authHeaders() }),
    );

    const result: Record<
      string,
      { value: any; timestamp: number; isLive: boolean }
    > = {};

    for (const [key, values] of Object.entries<any>(data)) {
      if (!values || values.length === 0) continue;
      const latest = values[0];
      const age = now - latest.ts;
      if (age <= timeWindowSeconds * 1000) {
        result[key] = {
          value: this.cast(latest.value),
          timestamp: latest.ts,
          isLive: age <= 10_000,
        };
      }
    }

    return result;
  }
}
