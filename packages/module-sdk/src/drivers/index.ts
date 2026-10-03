import { Server, ServerMetrics, SessionUser, PowerAction } from '@octopus/shared';
import { TentacleHttpClient } from '@octopus/tentacle-client';

export interface ProvisionOptions {
  ports: Array<{ hostPort: number; containerPort: number; protocol?: string }>;
  startOnCompletion?: boolean;
  extraEnv?: Record<string, string>;
}

export interface FileManagerDriver {
  listFiles(path?: string): Promise<unknown[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(paths: string[]): Promise<void>;
  createDirectory(path: string): Promise<void>;
  renameFile(root: string, files: Array<{ from: string; to: string }>): Promise<void>;
  chmodFile(root: string, files: Array<{ file: string; mode: string }>): Promise<void>;
}

export interface ServerProviderDriver {
  readonly id: string; // e.g. 'tentacle-docker', 'proxmox-lxc', 'proxmox-kvm'
  readonly displayName: string;

  // Lifecycle
  create(server: Server, options?: ProvisionOptions): Promise<void>;
  start(server: Server): Promise<void>;
  stop(server: Server, signal?: string): Promise<void>;
  restart(server: Server): Promise<void>;
  kill(server: Server): Promise<void>;
  delete(server: Server): Promise<void>;

  // Telemetry & Real-time I/O
  getMetrics(server: Server): Promise<ServerMetrics>;
  getConsoleStreamUrl(server: Server, userSession: SessionUser): Promise<string>;

  // Storage & Files
  getFileManager?(server: Server): FileManagerDriver;
}

export class TentacleProviderDriver implements ServerProviderDriver {
  readonly id = 'tentacle-docker';
  readonly displayName = 'Tentacle Daemon (Docker Engine)';

  private clientFactory: (nodeId: number) => Promise<TentacleHttpClient>;

  constructor(clientFactory: (nodeId: number) => Promise<TentacleHttpClient>) {
    this.clientFactory = clientFactory;
  }

  async create(server: Server, options?: ProvisionOptions): Promise<void> {
    const client = await this.clientFactory(server.nodeId);
    await client.createServer({
      uuid: server.uuid,
      image: server.dockerImage,
      memoryLimitMb: server.memory,
      swapLimitMb: server.swap,
      cpuLimitPercent: server.cpu,
      diskLimitMb: server.disk,
      ioWeight: server.io,
      ports: options?.ports || [],
      environment: { ...server.environment, ...(options?.extraEnv || {}) },
      startupCommand: server.startupCommand,
    });
  }

  async start(server: Server): Promise<void> {
    const client = await this.clientFactory(server.nodeId);
    await client.powerAction(server.uuid, PowerAction.START);
  }

  async stop(server: Server, _signal?: string): Promise<void> {
    const client = await this.clientFactory(server.nodeId);
    await client.powerAction(server.uuid, PowerAction.STOP);
  }

  async restart(server: Server): Promise<void> {
    const client = await this.clientFactory(server.nodeId);
    await client.powerAction(server.uuid, PowerAction.RESTART);
  }

  async kill(server: Server): Promise<void> {
    const client = await this.clientFactory(server.nodeId);
    await client.powerAction(server.uuid, PowerAction.KILL);
  }

  async delete(server: Server): Promise<void> {
    const client = await this.clientFactory(server.nodeId);
    await client.deleteServer(server.uuid);
  }

  async getMetrics(server: Server): Promise<ServerMetrics> {
    const client = await this.clientFactory(server.nodeId);
    const info = await client.getServer(server.uuid);
    if (info.metrics) {
      return info.metrics;
    }
    return {
      currentState: info.status,
      isSuspended: server.isSuspended,
      resources: {
        memoryBytes: 0,
        memoryLimitBytes: server.memory * 1024 * 1024,
        cpuAbsolute: 0,
        diskBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
        uptimeMs: 0,
      },
    };
  }

  async getConsoleStreamUrl(server: Server, _userSession: SessionUser): Promise<string> {
    return `/api/v1/servers/${server.uuid}/ws`;
  }
}

export class ProviderRegistry {
  private drivers = new Map<string, ServerProviderDriver>();
  private defaultDriverId = 'tentacle-docker';

  register(driver: ServerProviderDriver, isDefault = false): void {
    this.drivers.set(driver.id, driver);
    if (isDefault || !this.drivers.has(this.defaultDriverId)) {
      this.defaultDriverId = driver.id;
    }
  }

  get(id: string): ServerProviderDriver | undefined {
    return this.drivers.get(id);
  }

  getDefault(): ServerProviderDriver {
    const driver = this.drivers.get(this.defaultDriverId);
    if (!driver) {
      throw new Error(`Default provider driver '${this.defaultDriverId}' not registered`);
    }
    return driver;
  }

  list(): ServerProviderDriver[] {
    return Array.from(this.drivers.values());
  }
}

export const globalProviders = new ProviderRegistry();
