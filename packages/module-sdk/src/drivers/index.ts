import { Server, ServerMetrics, SessionUser, PowerAction } from '@octopus/shared';
import { TentacleHttpClient } from '@octopus/tentacle-client';

export interface ProvisionOptions {
  ports: Array<{ hostPort: number; containerPort: number; protocol?: string; hostIp?: string }>;
  startOnCompletion?: boolean;
  extraEnv?: Record<string, string>;
  installScript?: string;
  installContainer?: string;
  installEntrypoint?: string;
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
    const bp = (server as any).blueprint;
    let installConfig = undefined;
    if (options?.installScript && options?.installContainer) {
      installConfig = {
        image: options.installContainer,
        script: options.installScript,
        entrypoint: options.installEntrypoint || undefined,
      };
    } else if (bp?.installScript && bp?.installContainer) {
      installConfig = {
        image: bp.installContainer,
        script: bp.installScript,
        entrypoint: bp.installEntrypoint || undefined,
      };
    }

    const ports = options?.ports || [];
    if (ports.length === 0) {
      const mainAlloc = (server as any).allocation;
      if (mainAlloc?.port) {
        ports.push({
          hostPort: mainAlloc.port,
          containerPort: mainAlloc.port,
          protocol: 'tcp',
          hostIp: '0.0.0.0',
        });
      }
      const otherAllocs = (server as any).allocations;
      if (Array.isArray(otherAllocs)) {
        for (const a of otherAllocs) {
          if (a?.port && !ports.some((p) => p.hostPort === a.port)) {
            ports.push({
              hostPort: a.port,
              containerPort: a.port,
              protocol: 'tcp',
              hostIp: '0.0.0.0',
            });
          }
        }
      }
      if (ports.length === 0 && (server as any).environment?.SERVER_PORT) {
        const p = parseInt(String((server as any).environment.SERVER_PORT), 10);
        if (!isNaN(p) && p > 0) {
          ports.push({
            hostPort: p,
            containerPort: p,
            protocol: 'tcp',
            hostIp: '0.0.0.0',
          });
        }
      }
    }

    const finalEnv: Record<string, string> = {};
    if (Array.isArray(bp?.variables)) {
      for (const v of bp.variables) {
        if (v.envVariable) {
          finalEnv[v.envVariable] = String(v.defaultValue ?? '');
        }
      }
    }
    if (server.environment && typeof server.environment === 'object') {
      for (const [k, v] of Object.entries(server.environment)) {
        if (v !== undefined && v !== null) {
          finalEnv[k] = String(v);
        }
      }
    }
    if (options?.extraEnv) {
      for (const [k, v] of Object.entries(options.extraEnv)) {
        if (v !== undefined && v !== null) {
          finalEnv[k] = String(v);
        }
      }
    }
    if (ports.length > 0) {
      finalEnv['SERVER_PORT'] = finalEnv['SERVER_PORT'] || String(ports[0].hostPort);
      finalEnv['SERVER_IP'] = finalEnv['SERVER_IP'] || '0.0.0.0';
    }
    finalEnv['SERVER_MEMORY'] = finalEnv['SERVER_MEMORY'] || String(server.memory);

    let dockerImage = server.dockerImage;
    if (!dockerImage && bp) {
      dockerImage = bp.dockerImage || (bp.images && typeof bp.images === 'object' ? Object.values(bp.images)[0] : '') || '';
    }
    if (!dockerImage) {
      dockerImage = 'ghcr.io/ptero-eggs/yolks:java_21';
    }

    let startupCommand = server.startupCommand || bp?.startup || '';
    for (const [k, v] of Object.entries(finalEnv)) {
      startupCommand = startupCommand.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
    if (ports.length > 0) {
      startupCommand = startupCommand.replace(/\{\{server\.build\.default\.port\}\}/g, String(ports[0].hostPort));
    }

    finalEnv['STARTUP'] = finalEnv['STARTUP'] || startupCommand;

    const isMinecraft = bp?.features?.includes('eula') || bp?.name?.toLowerCase()?.includes('paper') || bp?.name?.toLowerCase()?.includes('minecraft') || dockerImage?.includes('java');
    if (isMinecraft) {
      finalEnv['EULA'] = 'true';
    }

    await client.createServer({
      uuid: server.uuid,
      name: server.name,
      image: dockerImage,
      memoryLimitMb: server.memory,
      swapLimitMb: server.swap,
      cpuLimitPercent: server.cpu,
      diskLimitMb: server.disk,
      ioWeight: server.io,
      ports,
      environment: finalEnv,
      startupCommand,
      installConfig,
    });

    if (installConfig) {
      try {
        await client.installServer(server.uuid);
      } catch (err) {
        console.error(`Failed to trigger installation pipeline for server ${server.uuid}:`, err);
      }
    }
  }

  async start(server: Server): Promise<void> {
    const client = await this.clientFactory(server.nodeId);
    const bp = (server as any).blueprint;
    const isMinecraft = bp?.features?.includes('eula') || bp?.name?.toLowerCase()?.includes('paper') || bp?.name?.toLowerCase()?.includes('minecraft') || server.dockerImage?.includes('java');
    if (isMinecraft) {
      try {
        await client.writeFile(server.uuid, 'eula.txt', 'eula=true\n');
      } catch {
        // Ignored
      }
    }

    try {
      await client.powerAction(server.uuid, PowerAction.START);
    } catch (err: any) {
      if (err?.message?.includes('404') || err?.message?.toLowerCase()?.includes('not found')) {
        await this.create(server);
        try {
          await new Promise((r) => setTimeout(r, 600));
          await client.powerAction(server.uuid, PowerAction.START);
        } catch (startErr: any) {
          if (startErr?.message?.toLowerCase()?.includes('install') || startErr?.message?.includes('400')) {
            console.log(`Server ${server.uuid} is currently undergoing installation.`);
            return;
          }
          throw startErr;
        }
        return;
      }
      throw err;
    }
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
