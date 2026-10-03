import { ServerStatus, PowerAction, UserRole } from '@octopus/shared';

export interface DemoFileItem {
  name: string;
  size: number;
  isFile: boolean;
  modified: string;
  mode: string;
}

export interface DemoAllocation {
  id: number;
  nodeId: number;
  ipAddress: string;
  port: number;
  alias: string | null;
  serverId: number | null;
  isPrimary: boolean;
  note: string | null;
  node: { name: string };
}

export interface DemoServer {
  id: number;
  uuid: string;
  identifier: string;
  name: string;
  description?: string;
  userId: number;
  nodeId: number;
  blueprintId: number;
  allocationId?: number;
  memory: number;
  cpu: number;
  disk: number;
  isSuspended: boolean;
  status: ServerStatus;
  providerType?: string;
  dockerImage: string;
  startupCommand: string;
  node: { id: number; name: string; fqdn: string; apiPort: number; countryFlag?: string; location?: string; pingMs?: number };
  allocation: { id: number; ipAddress: string; port: number; alias?: string | null; isPrimary: boolean };
  blueprint: { id: number; name: string; dockerImage: string };
  sftp?: {
    host: string;
    port: number;
    username: string;
    passwordPreview: string;
  };
  metrics?: {
    cpuCurrent: number;
    cpuLimit: number;
    memoryCurrentBytes: number;
    memoryLimitBytes: number;
    diskCurrentBytes: number;
    diskLimitBytes: number;
    networkRxBytes: number;
    networkTxBytes: number;
    uptimeSeconds: number;
  };
}

export interface ServerBackup {
  id: string;
  serverId: number;
  name: string;
  sizeBytes: number;
  isLocked: boolean;
  ignoredFiles: string[];
  status: 'completed' | 'in_progress' | 'failed';
  createdAt: string;
}

export interface ServerDatabase {
  id: string;
  serverId: number;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  databaseType: 'mysql' | 'postgres';
  createdAt: string;
}

export interface ScheduleTask {
  id: string;
  action: 'command' | 'power' | 'backup';
  payload: string;
  delaySeconds: number;
}

export interface ServerSchedule {
  id: string;
  serverId: number;
  name: string;
  cron: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
  tasks: ScheduleTask[];
}

export interface ServerSubuser {
  id: number;
  serverId: number;
  username: string;
  email: string;
  avatarUrl: string;
  permissions: string[];
  createdAt: string;
}

export interface EggVariable {
  key: string;
  name: string;
  description: string;
  defaultValue: string;
  currentValue: string;
  userViewable: boolean;
  userEditable: boolean;
  rules: string;
  fieldType: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
}

export interface ConfigParserRule {
  file: string;
  parser: 'yaml' | 'json' | 'properties' | 'ini';
  find: string;
  replace: string;
}

export const demoUser = {
  id: 1,
  uuid: 'usr_demo_01948abc-7000-7000-8000-000000000001',
  username: 'DemoAdmin',
  email: 'admin@octopuspanel.io',
  role: UserRole.ADMIN,
  languagePreference: 'en',
  twoFactorEnabled: false,
};

export const demoNodes = [
  {
    id: 1,
    uuid: 'nde_01948abc-node-0001',
    name: 'Node-DE-Frankfurt-01',
    fqdn: 'de-01.octopus.network',
    countryFlag: '🇩🇪',
    location: 'Frankfurt, Germany',
    pingMs: 14,
    apiPort: 8080,
    sftpPort: 2022,
    memoryLimit: 65536,
    memoryAllocated: 28672,
    diskLimit: 2097152,
    diskAllocated: 614400,
    serversCount: 14,
    isMaintenance: false,
    token: 'oct_node_sec_frankfurt_99182747192',
    hostOs: 'Ubuntu 24.04 LTS (Noble Numbat)',
    kernelVersion: '6.8.0-45-generic',
    dockerVersion: 'Docker Engine v26.1.4',
    cgroupsV2: true,
    daemonStatus: 'online',
    daemonVersion: 'v0.1.0',
    loadAvg: [0.42, 0.58, 0.65],
  },
  {
    id: 2,
    uuid: 'nde_01948abc-node-0002',
    name: 'Node-FR-Paris-01',
    countryFlag: '🇫🇷',
    location: 'Paris, France',
    pingMs: 22,
    fqdn: 'fr-01.octopus.network',
    apiPort: 8080,
    sftpPort: 2022,
    memoryLimit: 32768,
    memoryAllocated: 16384,
    diskLimit: 1048576,
    diskAllocated: 204800,
    serversCount: 6,
    isMaintenance: false,
    token: 'oct_node_sec_paris_88291048201',
    hostOs: 'Debian GNU/Linux 12 (bookworm)',
    kernelVersion: '6.1.0-21-amd64',
    dockerVersion: 'Docker Engine v26.0.2',
    cgroupsV2: true,
    daemonStatus: 'online',
    daemonVersion: 'v0.1.0',
    loadAvg: [0.18, 0.24, 0.31],
  },
  {
    id: 3,
    uuid: 'nde_01948abc-node-0003',
    name: 'Node-US-NewYork-01',
    countryFlag: '🇺🇸',
    location: 'New York, USA',
    pingMs: 86,
    fqdn: 'us-01.octopus.network',
    apiPort: 8080,
    sftpPort: 2022,
    memoryLimit: 131072,
    memoryAllocated: 73728,
    diskLimit: 4194304,
    diskAllocated: 1843200,
    serversCount: 22,
    isMaintenance: false,
    token: 'oct_node_sec_newyork_11928472910',
    hostOs: 'AlmaLinux 9.4 (Seafoam Ocelot)',
    kernelVersion: '5.14.0-427.35.1.el9_4.x86_64',
    dockerVersion: 'Docker Engine v25.0.5',
    cgroupsV2: true,
    daemonStatus: 'online',
    daemonVersion: 'v0.2.0',
    loadAvg: [1.12, 1.05, 0.98],
  },
];

export const demoBlueprints = [
  {
    id: 1,
    uuid: 'bp_paper_minecraft',
    name: 'Paper Minecraft 1.21.4',
    author: 'support@pterodactyl.io',
    category: 'Minecraft',
    description: 'High-performance Minecraft server software aiming to fix gameplay and mechanics inconsistencies as well as dramatically improving performance.',
    dockerImage: 'ghcr.io/pterodactyl/yolks:java_21',
    dockerImages: [
      'ghcr.io/pterodactyl/yolks:java_21',
      'ghcr.io/pterodactyl/yolks:java_17',
      'ghcr.io/pterodactyl/yolks:java_8',
    ],
    startupCommand: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M {{JVM_FLAGS}} -jar {{SERVER_JARFILE}}',
    stopCommand: 'stop',
    serversCount: 8,
    installScript: `#!/bin/bash
# PaperMC Auto-Installer
cd /mnt/server || exit 1
LATEST_VERSION="1.21.4"
BUILD_INFO=$(curl -s "https://api.papermc.io/v2/projects/paper/versions/\${LATEST_VERSION}/builds")
LATEST_BUILD=$(echo "$BUILD_INFO" | grep -o '"build":[0-9]*' | tail -n1 | cut -d: -f2)
JAR_NAME="paper-\${LATEST_VERSION}-\${LATEST_BUILD}.jar"
DOWNLOAD_URL="https://api.papermc.io/v2/projects/paper/versions/\${LATEST_VERSION}/builds/\${LATEST_BUILD}/downloads/\${JAR_NAME}"

echo "Downloading Paper \${LATEST_VERSION} (Build \${LATEST_BUILD})..."
curl -o server.jar "\${DOWNLOAD_URL}"
echo "Installation complete."
`,
    variables: [
      {
        key: 'SERVER_JARFILE',
        name: 'Server JAR File',
        description: 'The executable jar file for PaperMC.',
        defaultValue: 'server.jar',
        currentValue: 'server.jar',
        userViewable: true,
        userEditable: true,
        rules: 'required|string|max:40',
        fieldType: 'text' as const,
      },
      {
        key: 'MINECRAFT_VERSION',
        name: 'Minecraft Version',
        description: 'The game release version to run.',
        defaultValue: '1.21.4',
        currentValue: '1.21.4',
        userViewable: true,
        userEditable: true,
        rules: 'required|string',
        fieldType: 'select' as const,
        options: ['1.21.4', '1.21.3', '1.20.6', '1.20.4', '1.19.4'],
      },
      {
        key: 'BUILD_NUMBER',
        name: 'Build Number',
        description: 'PaperMC build number or "latest".',
        defaultValue: 'latest',
        currentValue: 'latest',
        userViewable: true,
        userEditable: true,
        rules: 'required|string',
        fieldType: 'text' as const,
      },
      {
        key: 'SERVER_MEMORY',
        name: 'Max Memory (MB)',
        description: 'Max heap memory allocation passed to Xmx.',
        defaultValue: '4096',
        currentValue: '4096',
        userViewable: true,
        userEditable: false,
        rules: 'required|numeric',
        fieldType: 'number' as const,
      },
      {
        key: 'JVM_FLAGS',
        name: 'Aikar JVM Optimization Flags',
        description: 'High performance garbage collection arguments.',
        defaultValue: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
        currentValue: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
        userViewable: true,
        userEditable: true,
        rules: 'nullable|string',
        fieldType: 'text' as const,
      },
      {
        key: 'EULA',
        name: 'Accept Mojang EULA',
        description: 'Must be true to run Minecraft servers.',
        defaultValue: 'true',
        currentValue: 'true',
        userViewable: true,
        userEditable: true,
        rules: 'required|boolean',
        fieldType: 'boolean' as const,
      },
    ],
    configRules: [
      {
        file: 'server.properties',
        parser: 'properties' as const,
        find: 'server-port',
        replace: '{{SERVER_PORT}}',
      },
      {
        file: 'server.properties',
        parser: 'properties' as const,
        find: 'server-ip',
        replace: '0.0.0.0',
      },
    ],
  },
  {
    id: 2,
    uuid: 'bp_rust_dedicated',
    name: 'Rust Dedicated Server',
    author: 'support@pterodactyl.io',
    category: 'Survival',
    description: 'Rust is a multiplayer-only survival video game developed by Facepunch Studios.',
    dockerImage: 'ghcr.io/pterodactyl/games:rust',
    dockerImages: [
      'ghcr.io/pterodactyl/games:rust',
      'ghcr.io/pterodactyl/games:rust-staging',
    ],
    startupCommand: './RustDedicated -batchmode +server.port {{SERVER_PORT}} +server.queryport {{QUERY_PORT}} +server.identity "docker" +rcon.port {{RCON_PORT}} +rcon.password "{{RCON_PASS}}" +server.maxplayers {{MAX_PLAYERS}}',
    stopCommand: 'quit',
    serversCount: 4,
    installScript: `#!/bin/bash
echo "Installing Rust Dedicated via SteamCMD..."
/steamcmd/steamcmd.sh +force_install_dir /mnt/server +login anonymous +app_update 258550 validate +quit
echo "Rust installation completed."
`,
    variables: [
      {
        key: 'MAX_PLAYERS',
        name: 'Max Players',
        description: 'Server player slot limit.',
        defaultValue: '100',
        currentValue: '150',
        userViewable: true,
        userEditable: true,
        rules: 'required|numeric|between:1,500',
        fieldType: 'number' as const,
      },
      {
        key: 'RCON_PORT',
        name: 'RCON Port',
        description: 'Remote console port binding.',
        defaultValue: '28016',
        currentValue: '28016',
        userViewable: true,
        userEditable: false,
        rules: 'required|numeric',
        fieldType: 'number' as const,
      },
      {
        key: 'RCON_PASS',
        name: 'RCON Password',
        description: 'Secret password to control the server console.',
        defaultValue: 'SecretRconPassword2026',
        currentValue: 'SecretRconPassword2026',
        userViewable: true,
        userEditable: true,
        rules: 'required|string',
        fieldType: 'text' as const,
      },
    ],
    configRules: [],
  },
  {
    id: 3,
    uuid: 'bp_palworld_dedicated',
    name: 'Palworld Dedicated',
    author: 'parkervcp',
    category: 'Survival',
    description: 'Palworld is a game about living in peace alongside mysterious creatures known as Pals.',
    dockerImage: 'ghcr.io/pterodactyl/games:source',
    dockerImages: ['ghcr.io/pterodactyl/games:source'],
    startupCommand: './PalServer.sh -port={{SERVER_PORT}} -players={{MAX_PLAYERS}} -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS',
    stopCommand: 'shutdown 10',
    serversCount: 2,
    installScript: `#!/bin/bash
echo "Installing Palworld Dedicated Server..."
/steamcmd/steamcmd.sh +force_install_dir /mnt/server +login anonymous +app_update 2394010 validate +quit
`,
    variables: [
      {
        key: 'MAX_PLAYERS',
        name: 'Max Players',
        description: 'Server player slot limit.',
        defaultValue: '32',
        currentValue: '32',
        userViewable: true,
        userEditable: true,
        rules: 'required|numeric',
        fieldType: 'number' as const,
      },
    ],
    configRules: [],
  },
  {
    id: 4,
    uuid: 'bp_fivem_server',
    name: 'FiveM FXServer',
    author: 'support@pterodactyl.io',
    category: 'GTA V / FiveM',
    description: 'Multiplayer modification framework for GTA V allowing customized game experiences.',
    dockerImage: 'ghcr.io/pterodactyl/games:fivem',
    dockerImages: ['ghcr.io/pterodactyl/games:fivem'],
    startupCommand: 'bash /entrypoint.sh +set sv_licenseKey "{{LICENSE_KEY}}" +set sv_maxclients {{MAX_PLAYERS}}',
    stopCommand: 'quit',
    serversCount: 3,
    installScript: `#!/bin/bash
echo "Installing FXServer Artifacts..."
`,
    variables: [
      {
        key: 'LICENSE_KEY',
        name: 'FiveM License Key',
        description: 'Cfx.re Keymaster license key.',
        defaultValue: 'cfxk_demo_license_key_sample',
        currentValue: 'cfxk_demo_license_key_sample',
        userViewable: true,
        userEditable: true,
        rules: 'required|string',
        fieldType: 'text' as const,
      },
      {
        key: 'MAX_PLAYERS',
        name: 'Max Clients',
        description: 'Server slot count (1-128).',
        defaultValue: '64',
        currentValue: '64',
        userViewable: true,
        userEditable: true,
        rules: 'required|numeric',
        fieldType: 'number' as const,
      },
    ],
    configRules: [],
  },
];

export const demoAllocations: DemoAllocation[] = [
  { id: 1, nodeId: 1, ipAddress: '198.51.100.24', port: 25565, alias: 'mc.octopus.network', serverId: 1, isPrimary: true, note: 'Primary Minecraft Port', node: { name: 'Node-DE-Frankfurt-01' } },
  { id: 2, nodeId: 1, ipAddress: '198.51.100.24', port: 28015, alias: 'rust.octopus.network', serverId: 2, isPrimary: true, note: 'Primary Rust Game Port', node: { name: 'Node-DE-Frankfurt-01' } },
  { id: 3, nodeId: 1, ipAddress: '198.51.100.24', port: 30120, alias: 'fivem.octopus.network', serverId: 4, isPrimary: true, note: 'Primary FXServer Port', node: { name: 'Node-DE-Frankfurt-01' } },
  { id: 4, nodeId: 2, ipAddress: '198.51.100.88', port: 8211, alias: 'pal.octopus.network', serverId: 3, isPrimary: true, note: 'Primary Palworld Port', node: { name: 'Node-FR-Paris-01' } },
  { id: 5, nodeId: 1, ipAddress: '198.51.100.24', port: 25566, alias: 'dynmap.octopus.network', serverId: 1, isPrimary: false, note: 'Dynmap Web Map UI', node: { name: 'Node-DE-Frankfurt-01' } },
  { id: 6, nodeId: 1, ipAddress: '198.51.100.24', port: 25567, alias: 'rcon.mc.octopus.network', serverId: 1, isPrimary: false, note: 'Minecraft RCON Port', node: { name: 'Node-DE-Frankfurt-01' } },
  { id: 7, nodeId: 1, ipAddress: '198.51.100.24', port: 28016, alias: 'rcon.rust.octopus.network', serverId: 2, isPrimary: false, note: 'Rust RCON WebSocket', node: { name: 'Node-DE-Frankfurt-01' } },
  { id: 8, nodeId: 2, ipAddress: '198.51.100.88', port: 8212, alias: null, serverId: null, isPrimary: false, note: null, node: { name: 'Node-FR-Paris-01' } },
  { id: 9, nodeId: 3, ipAddress: '198.51.100.150', port: 27015, alias: 'cs2.octopus.network', serverId: null, isPrimary: false, note: null, node: { name: 'Node-US-NewYork-01' } },
  { id: 10, nodeId: 1, ipAddress: '198.51.100.24', port: 25568, alias: null, serverId: null, isPrimary: false, note: null, node: { name: 'Node-DE-Frankfurt-01' } },
  { id: 11, nodeId: 1, ipAddress: '198.51.100.24', port: 25569, alias: null, serverId: null, isPrimary: false, note: null, node: { name: 'Node-DE-Frankfurt-01' } },
  { id: 12, nodeId: 1, ipAddress: '198.51.100.24', port: 25570, alias: null, serverId: null, isPrimary: false, note: null, node: { name: 'Node-DE-Frankfurt-01' } },
];

export const demoServers: DemoServer[] = [
  {
    id: 1,
    uuid: 'srv_mc_121-paper-0001',
    identifier: 'mc-paper',
    name: 'Minecraft Paper 1.21.4 (Survival)',
    description: 'High-performance paper 1.21.4 survival smp with Dynmap and CoreProtect.',
    userId: 1,
    nodeId: 1,
    blueprintId: 1,
    allocationId: 1,
    memory: 4096,
    cpu: 200,
    disk: 35840,
    isSuspended: false,
    status: ServerStatus.RUNNING,
    providerType: 'tentacle_docker',
    dockerImage: 'ghcr.io/pterodactyl/yolks:java_21',
    startupCommand: 'java -Xms128M -Xmx4096M -XX:+UseG1GC -jar server.jar',
    node: { id: 1, name: 'Node-DE-Frankfurt-01', fqdn: 'de-01.octopus.network', apiPort: 8080, countryFlag: '🇩🇪', location: 'Frankfurt, Germany', pingMs: 14 },
    allocation: { id: 1, ipAddress: '198.51.100.24', port: 25565, alias: 'mc.octopus.network', isPrimary: true },
    blueprint: { id: 1, name: 'Paper Minecraft 1.21.4', dockerImage: 'ghcr.io/pterodactyl/yolks:java_21' },
    sftp: {
      host: 'de-01.octopus.network',
      port: 2022,
      username: 'DemoAdmin.mc-paper',
      passwordPreview: 'oct_sftp_sec_pass_8819',
    },
    metrics: {
      cpuCurrent: 18.4,
      cpuLimit: 200,
      memoryCurrentBytes: 1971322880, // ~1.84 GB
      memoryLimitBytes: 4294967296, // 4.00 GB
      diskCurrentBytes: 15247133696, // ~14.2 GB
      diskLimitBytes: 37580963840, // 35.0 GB
      networkRxBytes: 14889779, // 14.2 MB
      networkTxBytes: 50960793, // 48.6 MB
      uptimeSeconds: 411120, // ~4d 18h 12m
    },
  },
  {
    id: 2,
    uuid: 'srv_rust_main-0002',
    identifier: 'rust-main',
    name: 'Rust Vanilla 2x (Monthly Wipe)',
    description: 'Main European Rust PVP Server with 2x gathering speed.',
    userId: 1,
    nodeId: 1,
    blueprintId: 2,
    allocationId: 2,
    memory: 8192,
    cpu: 400,
    disk: 61440,
    isSuspended: false,
    status: ServerStatus.RUNNING,
    providerType: 'tentacle_docker',
    dockerImage: 'ghcr.io/pterodactyl/games:rust',
    startupCommand: './RustDedicated -batchmode +server.port 28015 +server.queryport 28016 +server.identity "docker"',
    node: { id: 1, name: 'Node-DE-Frankfurt-01', fqdn: 'de-01.octopus.network', apiPort: 8080, countryFlag: '🇩🇪', location: 'Frankfurt, Germany', pingMs: 14 },
    allocation: { id: 2, ipAddress: '198.51.100.24', port: 28015, alias: 'rust.octopus.network', isPrimary: true },
    blueprint: { id: 2, name: 'Rust Dedicated Server', dockerImage: 'ghcr.io/pterodactyl/games:rust' },
    sftp: {
      host: 'de-01.octopus.network',
      port: 2022,
      username: 'DemoAdmin.rust-main',
      passwordPreview: 'oct_sftp_sec_pass_3321',
    },
    metrics: {
      cpuCurrent: 42.1,
      cpuLimit: 400,
      memoryCurrentBytes: 5153960755, // ~4.8 GB
      memoryLimitBytes: 8589934592, // 8.0 GB
      diskCurrentBytes: 25769803776, // 24.0 GB
      diskLimitBytes: 64424509440, // 60.0 GB
      networkRxBytes: 48234496,
      networkTxBytes: 154140672,
      uptimeSeconds: 88400, // ~1d 0h 33m
    },
  },
  {
    id: 3,
    uuid: 'srv_palworld_ded-0003',
    identifier: 'palworld',
    name: 'Palworld Community Dedicated',
    description: 'Casual community server with co-op building and dungeons.',
    userId: 1,
    nodeId: 2,
    blueprintId: 3,
    allocationId: 4,
    memory: 16384,
    cpu: 400,
    disk: 51200,
    isSuspended: false,
    status: ServerStatus.STARTING,
    providerType: 'tentacle_docker',
    dockerImage: 'ghcr.io/pterodactyl/games:source',
    startupCommand: './PalServer.sh -port=8211 -players=32',
    node: { id: 2, name: 'Node-FR-Paris-01', fqdn: 'fr-01.octopus.network', apiPort: 8080, countryFlag: '🇫🇷', location: 'Paris, France', pingMs: 22 },
    allocation: { id: 4, ipAddress: '198.51.100.88', port: 8211, alias: 'pal.octopus.network', isPrimary: true },
    blueprint: { id: 3, name: 'Palworld Dedicated', dockerImage: 'ghcr.io/pterodactyl/games:source' },
    sftp: {
      host: 'fr-01.octopus.network',
      port: 2022,
      username: 'DemoAdmin.palworld',
      passwordPreview: 'oct_sftp_sec_pass_5510',
    },
    metrics: {
      cpuCurrent: 8.5,
      cpuLimit: 400,
      memoryCurrentBytes: 1288490188, // ~1.2 GB
      memoryLimitBytes: 17179869184, // 16.0 GB
      diskCurrentBytes: 10737418240, // 10.0 GB
      diskLimitBytes: 53687091200, // 50.0 GB
      networkRxBytes: 1048576,
      networkTxBytes: 3145728,
      uptimeSeconds: 120, // 2m
    },
  },
  {
    id: 4,
    uuid: 'srv_fivem_rp-0004',
    identifier: 'fivem-rp',
    name: 'FiveM Los Santos Roleplay',
    description: 'Custom QBCore roleplay server with 250+ custom vehicles.',
    userId: 1,
    nodeId: 1,
    blueprintId: 4,
    allocationId: 3,
    memory: 12288,
    cpu: 300,
    disk: 81920,
    isSuspended: false,
    status: ServerStatus.OFFLINE,
    providerType: 'tentacle_docker',
    dockerImage: 'ghcr.io/pterodactyl/games:fivem',
    startupCommand: 'bash /entrypoint.sh +set sv_maxclients 64',
    node: { id: 1, name: 'Node-DE-Frankfurt-01', fqdn: 'de-01.octopus.network', apiPort: 8080, countryFlag: '🇩🇪', location: 'Frankfurt, Germany', pingMs: 14 },
    allocation: { id: 3, ipAddress: '198.51.100.24', port: 30120, alias: 'fivem.octopus.network', isPrimary: true },
    blueprint: { id: 4, name: 'FiveM FXServer', dockerImage: 'ghcr.io/pterodactyl/games:fivem' },
    sftp: {
      host: 'de-01.octopus.network',
      port: 2022,
      username: 'DemoAdmin.fivem-rp',
      passwordPreview: 'oct_sftp_sec_pass_9024',
    },
    metrics: {
      cpuCurrent: 0,
      cpuLimit: 300,
      memoryCurrentBytes: 0,
      memoryLimitBytes: 12884901888,
      diskCurrentBytes: 42949672960, // 40 GB
      diskLimitBytes: 85899345920, // 80 GB
      networkRxBytes: 0,
      networkTxBytes: 0,
      uptimeSeconds: 0,
    },
  },
];

export const demoBackups: Record<number, ServerBackup[]> = {
  1: [
    {
      id: 'bkp_01948abc_daily_01',
      serverId: 1,
      name: 'Pre-1.21.4 Update Full World Snapshot',
      sizeBytes: 1288490188, // 1.2 GB
      isLocked: true,
      ignoredFiles: ['logs/*', 'cache/*'],
      status: 'completed',
      createdAt: '2026-10-02T04:00:15Z',
    },
    {
      id: 'bkp_01948abc_daily_02',
      serverId: 1,
      name: 'Nightly Automated Backup',
      sizeBytes: 1395864371, // 1.3 GB
      isLocked: false,
      ignoredFiles: ['logs/*'],
      status: 'completed',
      createdAt: '2026-10-03T04:00:22Z',
    },
    {
      id: 'bkp_01948abc_manual_01',
      serverId: 1,
      name: 'Manual Plugin Essentials Reconfig',
      sizeBytes: 943718400, // 900 MB
      isLocked: false,
      ignoredFiles: [],
      status: 'completed',
      createdAt: '2026-10-03T14:10:00Z',
    },
  ],
  2: [
    {
      id: 'bkp_rust_01',
      serverId: 2,
      name: 'Pre-Wipe Map & Player Blueprints',
      sizeBytes: 2576980377,
      isLocked: true,
      ignoredFiles: [],
      status: 'completed',
      createdAt: '2026-10-01T12:00:00Z',
    },
  ],
};

export const demoDatabases: Record<number, ServerDatabase[]> = {
  1: [
    {
      id: 'db_mc_coreprotect',
      serverId: 1,
      name: 's1_coreprotect_db',
      host: '127.0.0.1',
      port: 3306,
      username: 'u1_coreprot_user',
      password: 'Sql_Secret_Pwd_9921#x',
      databaseType: 'mysql',
      createdAt: '2026-09-15T10:00:00Z',
    },
    {
      id: 'db_mc_luckperms',
      serverId: 1,
      name: 's1_luckperms_db',
      host: '127.0.0.1',
      port: 5432,
      username: 'u1_luckperms_pg',
      password: 'Postgres_Pwd_Safe_882!q',
      databaseType: 'postgres',
      createdAt: '2026-09-20T11:30:00Z',
    },
  ],
  4: [
    {
      id: 'db_fivem_qbcore',
      serverId: 4,
      name: 's4_qbcore_main',
      host: '127.0.0.1',
      port: 3306,
      username: 'u4_fivem_db_user',
      password: 'FiveM_Db_Master_Pass_3389',
      databaseType: 'mysql',
      createdAt: '2026-09-18T14:20:00Z',
    },
  ],
};

export const demoSchedules: Record<number, ServerSchedule[]> = {
  1: [
    {
      id: 'sch_restart_daily',
      serverId: 1,
      name: 'Daily Graceful Restart & Clean',
      cron: '0 4 * * *',
      isActive: true,
      lastRunAt: '2026-10-03T04:00:00Z',
      nextRunAt: '2026-10-04T04:00:00Z',
      tasks: [
        { id: 'tsk_1', action: 'command', payload: 'broadcast Server restarting for scheduled maintenance in 60s!', delaySeconds: 0 },
        { id: 'tsk_2', action: 'command', payload: 'save-all', delaySeconds: 30 },
        { id: 'tsk_3', action: 'power', payload: 'restart', delaySeconds: 30 },
      ],
    },
    {
      id: 'sch_world_backup',
      serverId: 1,
      name: 'Hourly Nether & Overworld Backup',
      cron: '0 * * * *',
      isActive: true,
      lastRunAt: '2026-10-03T18:00:00Z',
      nextRunAt: '2026-10-03T19:00:00Z',
      tasks: [
        { id: 'tsk_b1', action: 'backup', payload: 'Hourly World Backup', delaySeconds: 0 },
      ],
    },
    {
      id: 'sch_broadcast_tips',
      serverId: 1,
      name: 'Every 30 Minutes Community Notice',
      cron: '*/30 * * * *',
      isActive: true,
      lastRunAt: '2026-10-03T18:30:00Z',
      nextRunAt: '2026-10-03T19:00:00Z',
      tasks: [
        { id: 'tsk_m1', action: 'command', payload: 'say Welcome to our server! Join our Discord at discord.gg/octopus', delaySeconds: 0 },
      ],
    },
  ],
};

export const demoSubusers: Record<number, ServerSubuser[]> = {
  1: [
    {
      id: 101,
      serverId: 1,
      username: 'AlexAdmin',
      email: 'alex.mod@studio-craft.net',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      permissions: [
        'websocket.connect',
        'control.start',
        'control.stop',
        'control.restart',
        'file.read',
        'file.update',
        'file.create',
      ],
      createdAt: '2026-09-22T10:00:00Z',
    },
    {
      id: 102,
      serverId: 1,
      username: 'SarahDev',
      email: 'sarah.plugins@studio-craft.net',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces',
      permissions: [
        'websocket.connect',
        'file.read',
        'file.update',
        'file.create',
        'file.delete',
        'file.archive',
        'startup.read',
        'startup.update',
      ],
      createdAt: '2026-09-25T14:30:00Z',
    },
  ],
};

export const demoUsers = [
  { id: 1, uuid: 'usr_001', username: 'DemoAdmin', email: 'admin@octopuspanel.io', role: UserRole.ADMIN, languagePreference: 'en', twoFactorEnabled: true, createdAt: '2026-01-10T12:00:00Z' },
  { id: 2, uuid: 'usr_002', username: 'AlexHoster', email: 'alex@hostcloud.eu', role: UserRole.ADMIN, languagePreference: 'de', twoFactorEnabled: false, createdAt: '2026-02-15T14:30:00Z' },
  { id: 3, uuid: 'usr_003', username: 'GameDevMax', email: 'max@studio-craft.net', role: UserRole.USER, languagePreference: 'en', twoFactorEnabled: false, createdAt: '2026-03-01T09:15:00Z' },
  { id: 4, uuid: 'usr_004', username: 'CloudCustomer', email: 'user@gmail.com', role: UserRole.USER, languagePreference: 'de', twoFactorEnabled: false, createdAt: '2026-03-20T18:00:00Z' },
];

export const demoModules = [
  {
    id: 'module_billing',
    name: 'Billing & Subscriptions',
    version: '1.0.0',
    author: 'Octopus Core Team',
    description: 'All-in-One E-Commerce suite with Stripe, PayPal, Wallet and auto-provisioning.',
    isEnabled: true,
    uiSlots: ['dashboard:widgets', 'sidebar:user', 'sidebar:admin'],
    computeDrivers: [],
  },
  {
    id: 'module_proxmox_kvm',
    name: 'Proxmox VE KVM / LXC Provider',
    version: '0.9.2',
    author: 'Octopus Community',
    description: 'Extends OctopusPanel to manage KVM Virtual Machines and LXC containers alongside Docker.',
    isEnabled: true,
    uiSlots: ['server:tabs'],
    computeDrivers: ['proxmox-kvm', 'proxmox-lxc'],
  },
  {
    id: 'module_discord_sync',
    name: 'Discord Guild & Role Sync',
    version: '1.2.0',
    author: 'Community Contributor',
    description: 'Synchronizes customer roles, bans and power alerts with Discord server channels.',
    isEnabled: false,
    uiSlots: [],
    computeDrivers: [],
  },
];

export const demoFiles: Record<string, DemoFileItem[]> = {
  root: [
    { name: 'plugins', size: 4096, isFile: false, modified: '2026-10-03 14:20:11', mode: 'drwxr-xr-x' },
    { name: 'world', size: 4096, isFile: false, modified: '2026-10-03 18:15:42', mode: 'drwxr-xr-x' },
    { name: 'logs', size: 4096, isFile: false, modified: '2026-10-03 18:25:00', mode: 'drwxr-xr-x' },
    { name: 'server.properties', size: 1248, isFile: true, modified: '2026-10-03 18:10:00', mode: '-rw-r--r--' },
    { name: 'paper.yml', size: 3820, isFile: true, modified: '2026-10-03 14:15:00', mode: '-rw-r--r--' },
    { name: 'spigot.yml', size: 2940, isFile: true, modified: '2026-10-03 14:15:00', mode: '-rw-r--r--' },
    { name: 'eula.txt', size: 180, isFile: true, modified: '2026-10-03 14:05:00', mode: '-rw-r--r--' },
    { name: 'server.jar', size: 68420112, isFile: true, modified: '2026-10-03 14:02:00', mode: '-rwxr-xr-x' },
  ],
  plugins: [
    { name: 'EssentialsX.jar', size: 4194304, isFile: true, modified: '2026-10-02 11:20:00', mode: '-rw-r--r--' },
    { name: 'LuckPerms.jar', size: 2097152, isFile: true, modified: '2026-10-02 11:22:00', mode: '-rw-r--r--' },
    { name: 'Vault.jar', size: 524288, isFile: true, modified: '2026-10-02 11:25:00', mode: '-rw-r--r--' },
    { name: 'Dynmap.jar', size: 8388608, isFile: true, modified: '2026-10-02 11:30:00', mode: '-rw-r--r--' },
  ],
};

export const demoFileContents: Record<string, string> = {
  'server.properties': `#Minecraft server properties
#Sat Oct 03 18:10:00 UTC 2026
server-port=25565
gamemode=survival
difficulty=hard
motd=\\u00a7b\\u00a7lOctopusPanel \\u00a77- High Performance Rust Daemon
max-players=50
online-mode=true
pvp=true
view-distance=12
simulation-distance=10
enable-command-block=true
white-list=false
level-name=world
spawn-protection=0
`,
  'eula.txt': `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).
#Sat Oct 03 14:05:00 UTC 2026
eula=true
`,
  'paper.yml': `# Paper configuration file
verbose: false
config-version: 28
settings:
  max-player-auto-save-per-tick: 10
  bungee-online-mode: true
  save-empty-scoreboard-teams: false
  player-auto-save-rate: -1
  velocity-support:
    enabled: false
    online-mode: false
    secret: ''
world-settings:
  default:
    entity-per-chunk-save-limit:
      experience_orb: -1
      snowball: -1
      arrow: 16
    despawn-ranges:
      monster:
        soft: 32
        hard: 128
`,
};

export interface DemoSystemUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string;
}

export const demoSystemUpdates: DemoSystemUpdateInfo = {
  currentVersion: '0.1.0',
  latestVersion: '0.2.0',
  hasUpdate: true,
  releaseName: 'OctopusPanel v0.2.0 - Centralized Fleet Update & DB Snapshot Orchestration',
  releaseNotes: `### 🐙 Highlights in v0.2.0
- **1-Click Remote Node Fleet Updates:** Zero-downtime updates across all Tentacle host nodes. Game containers stay online without interruption!
- **Automated Database Snapshots:** Pre-migration gzip dumps with automatic rollback guard if migrations fail.
- **Live Terminal Log Streaming:** Real-time visual progress bar and streaming logs during updates.
- **Database Snapshot Cockpit:** Full manual trigger, direct download of .sql.gz dumps, and one-click restore.`,
  publishedAt: '2026-10-04T00:00:00Z',
  downloadUrl: 'https://github.com/OctopusPanel/panel/releases/tag/v0.2.0',
};

export interface DemoDatabaseSnapshot {
  id: string;
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  type: 'pre-migration' | 'manual' | 'scheduled';
  version: string;
}

export const demoDatabaseSnapshots: DemoDatabaseSnapshot[] = [
  {
    id: 'pre-migration-backup-v0.1.0-1728000000000.sql.gz',
    filename: 'pre-migration-backup-v0.1.0-1728000000000.sql.gz',
    sizeBytes: 2457600,
    sizeFormatted: '2.34 MB',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    type: 'pre-migration',
    version: '0.1.0',
  },
  {
    id: 'manual-backup-v0.1.0-1728086400000.sql.gz',
    filename: 'manual-backup-v0.1.0-1728086400000.sql.gz',
    sizeBytes: 2516582,
    sizeFormatted: '2.40 MB',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    type: 'manual',
    version: '0.1.0',
  },
];
