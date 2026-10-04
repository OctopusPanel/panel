import { ServerStatus, PowerAction, ServerMetrics } from '@octopus/shared';

export interface TentacleClientConfig {
  baseUrl: string;
  fallbackBaseUrl?: string;
  token: string;
  timeoutMs?: number;
}

export interface TentacleDiskInfo {
  name: string;
  mount_point: string;
  total_space_bytes: number;
  available_space_bytes: number;
}

export interface TentacleHostSystemInfo {
  os_name: string;
  os_version: string;
  kernel_version: string;
  host_name: string;
  total_memory_bytes: number;
  used_memory_bytes: number;
  total_swap_bytes?: number;
  used_swap_bytes?: number;
  cpu_count: number;
  global_cpu_usage_pct: number;
  disks: TentacleDiskInfo[];
}

export interface TentacleSystemStatus {
  node_id?: string | number;
  node_name?: string;
  system?: TentacleHostSystemInfo;
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

export interface TentaclePortAllocation {
  host_ip: string;
  host_port: number;
  container_port: number;
  protocol: string;
}

export interface TentacleInstallConfig {
  image: string;
  script: string;
  entrypoint?: string;
}

export interface TentacleServerCreateOptions {
  uuid: string;
  name?: string;
  image: string;
  memoryLimitMb?: number;
  swapLimitMb?: number;
  cpuLimitPercent?: number;
  diskLimitMb?: number;
  ioWeight?: number;
  ports?: Array<{ hostPort: number; containerPort: number; protocol?: string; hostIp?: string }>;
  environment?: Record<string, string>;
  startupCommand: string;
  stopCommand?: string;
  stopTimeoutSecs?: number;
  installConfig?: TentacleInstallConfig;
}

export interface TentacleServerCreatePayload {
  id: string;
  name: string;
  docker_image: string;
  startup_command: string;
  stop_command?: string;
  stop_timeout_secs: number;
  environment: Record<string, string>;
  allocations: TentaclePortAllocation[];
  memory_limit_bytes?: number;
  swap_limit_bytes?: number;
  cpu_quota?: number;
  cpu_period?: number;
  disk_quota_bytes?: number;
  start_detection_regex?: string;
  crash_detection_regex?: string;
  install_config?: TentacleInstallConfig;
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
