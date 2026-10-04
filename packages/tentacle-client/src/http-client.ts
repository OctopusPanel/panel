import {
  TentacleClientConfig,
  TentacleSystemStatus,
  TentacleSystemMetrics,
  TentacleServerCreateOptions,
  TentacleServerCreatePayload,
  TentaclePortAllocation,
  TentacleServerInfo,
  TentacleFileEntry,
  TentacleUpdatePayload,
  TentacleUpdateResult,
} from './types.js';
import { PowerAction, ServerMetrics } from '@octopus/shared';

export class TentacleHttpClient {
  private readonly baseUrl: string;
  private readonly fallbackBaseUrl?: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(config: TentacleClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.fallbackBaseUrl = config.fallbackBaseUrl?.replace(/\/+$/, '');
    this.token = config.token;
    this.timeoutMs = config.timeoutMs || 15000;
  }

  private async executeFetch<T>(base: string, path: string, options: RequestInit = {}): Promise<T> {
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${this.token}`);
      if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }

      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        throw new Error(`Tentacle HTTP ${res.status} (${res.statusText}): ${errorBody}`);
      }

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return (await res.json()) as T;
      }
      return (await res.text()) as unknown as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    try {
      return await this.executeFetch<T>(this.baseUrl, path, options);
    } catch (err: any) {
      // If primary base URL failed with network error and fallback is available, try fallback
      if (this.fallbackBaseUrl && this.fallbackBaseUrl !== this.baseUrl && !err.message?.includes('Tentacle HTTP')) {
        return await this.executeFetch<T>(this.fallbackBaseUrl, path, options);
      }
      throw err;
    }
  }

  // System & Health
  async getHealth(): Promise<{ status: string; service: string; version: string }> {
    return this.request('/health');
  }

  async getSystemStatus(): Promise<TentacleSystemStatus> {
    return this.request('/api/system');
  }

  async getSystemMetrics(): Promise<TentacleSystemMetrics> {
    return this.request('/api/system/metrics');
  }

  // Servers
  async listServers(): Promise<TentacleServerInfo[]> {
    return this.request('/api/servers');
  }

  async createServer(options: TentacleServerCreateOptions): Promise<void> {
    const memoryBytes = options.memoryLimitMb ? options.memoryLimitMb * 1024 * 1024 : undefined;
    const swapBytes = options.swapLimitMb !== undefined && options.swapLimitMb >= 0 ? options.swapLimitMb * 1024 * 1024 : undefined;
    const diskBytes = options.diskLimitMb ? options.diskLimitMb * 1024 * 1024 : undefined;
    const cpuQuota = options.cpuLimitPercent ? options.cpuLimitPercent * 1000 : undefined;
    const cpuPeriod = options.cpuLimitPercent ? 100000 : undefined;

    const allocations: TentaclePortAllocation[] = (options.ports || []).map((p) => ({
      host_ip: p.hostIp || '0.0.0.0',
      host_port: p.hostPort,
      container_port: p.containerPort,
      protocol: (p.protocol || 'tcp').toLowerCase(),
    }));

    const payload: TentacleServerCreatePayload = {
      id: options.uuid,
      name: options.name || `Server ${options.uuid.slice(0, 8)}`,
      docker_image: options.image,
      startup_command: options.startupCommand,
      stop_command: options.stopCommand || undefined,
      stop_timeout_secs: options.stopTimeoutSecs || 30,
      environment: options.environment || {},
      allocations,
      memory_limit_bytes: memoryBytes,
      swap_limit_bytes: swapBytes,
      cpu_quota: cpuQuota,
      cpu_period: cpuPeriod,
      disk_quota_bytes: diskBytes,
      install_config: options.installConfig,
    };

    await this.request('/api/servers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getServer(uuid: string): Promise<TentacleServerInfo> {
    return this.request(`/api/servers/${uuid}`);
  }

  async deleteServer(uuid: string): Promise<void> {
    await this.request(`/api/servers/${uuid}`, {
      method: 'DELETE',
    });
  }

  async powerAction(uuid: string, action: PowerAction): Promise<void> {
    await this.request(`/api/servers/${uuid}/power`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  async installServer(
    uuid: string,
    options?: { script: string; container: string; entrypoint?: string },
  ): Promise<void> {
    await this.request(`/api/servers/${uuid}/install`, {
      method: 'POST',
      body: options ? JSON.stringify(options) : undefined,
    });
  }

  // Files
  async listFiles(uuid: string, directory: string = '/'): Promise<TentacleFileEntry[]> {
    const encodedDir = encodeURIComponent(directory);
    return this.request(`/api/servers/${uuid}/files?directory=${encodedDir}`);
  }

  async readFile(uuid: string, filePath: string): Promise<string> {
    const encodedFile = encodeURIComponent(filePath);
    return this.request(`/api/servers/${uuid}/files/contents?file=${encodedFile}`);
  }

  async writeFile(uuid: string, filePath: string, content: string): Promise<void> {
    await this.request(`/api/servers/${uuid}/files/contents`, {
      method: 'POST',
      body: JSON.stringify({ file: filePath, content }),
    });
  }

  async deleteFile(uuid: string, paths: string[]): Promise<void> {
    await this.request(`/api/servers/${uuid}/files`, {
      method: 'DELETE',
      body: JSON.stringify({ paths }),
    });
  }

  async createDirectory(uuid: string, directoryPath: string): Promise<void> {
    await this.request(`/api/servers/${uuid}/files/directory`, {
      method: 'POST',
      body: JSON.stringify({ path: directoryPath }),
    });
  }

  async renameFile(uuid: string, root: string, files: Array<{ from: string; to: string }>): Promise<void> {
    await this.request(`/api/servers/${uuid}/files/rename`, {
      method: 'POST',
      body: JSON.stringify({ root, files }),
    });
  }

  async chmodFile(uuid: string, root: string, files: Array<{ file: string; mode: string }>): Promise<void> {
    await this.request(`/api/servers/${uuid}/files/chmod`, {
      method: 'POST',
      body: JSON.stringify({ root, files }),
    });
  }

  async compressFiles(uuid: string, root: string, files: string[]): Promise<{ archivePath: string }> {
    return this.request(`/api/servers/${uuid}/files/compress`, {
      method: 'POST',
      body: JSON.stringify({ root, files }),
    });
  }

  async decompressFile(uuid: string, root: string, file: string): Promise<void> {
    await this.request(`/api/servers/${uuid}/files/decompress`, {
      method: 'POST',
      body: JSON.stringify({ root, file }),
    });
  }

  async updateDaemon(payload: TentacleUpdatePayload): Promise<TentacleUpdateResult> {
    return this.request('/api/system/update', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}
