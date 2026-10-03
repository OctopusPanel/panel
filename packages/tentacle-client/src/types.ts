import { ServerStatus, PowerAction, ServerMetrics } from '@octopus/shared';

export interface TentacleClientConfig {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
}

export interface TentacleSystemStatus {
  os?: string;
  kernel?: string;
  uptimeSeconds?: number;
  cpuCores?: number;
}

export interface TentacleSystemMetrics {
  cpuUsagePercent: number;
  memoryTotalMb: number;
  memoryUsedMb: number;
  diskTotalMb: number;
  diskUsedMb: number;
}

export interface TentacleServerCreateOptions {
  uuid: string;
  image: string;
  memoryLimitMb: number;
  swapLimitMb: number;
  cpuLimitPercent: number;
  diskLimitMb: number;
  ioWeight?: number;
  ports: Array<{ hostPort: number; containerPort: number; protocol?: string }>;
  environment: Record<string, string>;
  startupCommand: string;
  stopCommand?: string;
}

export interface TentacleServerInfo {
  uuid: string;
  containerId?: string;
  status: ServerStatus;
  metrics?: ServerMetrics;
}

export interface TentacleFileEntry {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  isSymlink: boolean;
  mode: string;
  modifiedAt: string;
}

export type TentacleWsEventType = 'console_output' | 'status' | 'stats' | 'token_expiring' | 'error';

export interface TentacleWsMessage {
  event: TentacleWsEventType;
  args?: unknown[];
}

export interface TentacleUpdatePayload {
  targetVersion: string;
  sha256: string;
  downloadUrl: string;
}

export interface TentacleUpdateResult {
  success: boolean;
  message: string;
  target_version: string;
}
