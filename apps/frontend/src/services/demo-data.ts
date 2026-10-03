import { ServerStatus, PowerAction, UserRole } from '@octopus/shared';

export interface DemoFileItem {
  name: string;
  size: number;
  isFile: boolean;
  modified: string;
  mode: string;
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
    apiPort: 8080,
    sftpPort: 2022,
    memoryLimit: 65536,
    diskLimit: 2097152,
    serversCount: 14,
    isMaintenance: false,
  },
  {
    id: 2,
    uuid: 'nde_01948abc-node-0002',
    name: 'Node-FR-Paris-01',
    fqdn: 'fr-01.octopus.network',
    apiPort: 8080,
    sftpPort: 2022,
    memoryLimit: 32768,
    diskLimit: 1048576,
    serversCount: 6,
    isMaintenance: false,
  },
  {
    id: 3,
    uuid: 'nde_01948abc-node-0003',
    name: 'Node-US-NewYork-01',
    fqdn: 'us-01.octopus.network',
    apiPort: 8080,
    sftpPort: 2022,
    memoryLimit: 131072,
    diskLimit: 4194304,
    serversCount: 22,
    isMaintenance: false,
  },
];

export const demoBlueprints = [
  {
    id: 1,
    uuid: 'bp_paper_minecraft',
    name: 'Paper Minecraft 1.21.4',
    author: 'support@pterodactyl.io',
    dockerImage: 'ghcr.io/pterodactyl/yolks:java_21',
    startupCommand: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar',
    stopCommand: 'stop',
    serversCount: 8,
  },
  {
    id: 2,
    uuid: 'bp_rust_dedicated',
    name: 'Rust Dedicated Server',
    author: 'support@pterodactyl.io',
    dockerImage: 'ghcr.io/pterodactyl/games:rust',
    startupCommand: './RustDedicated -batchmode +server.port {{SERVER_PORT}} +server.identity "docker"',
    stopCommand: 'quit',
    serversCount: 4,
  },
  {
    id: 3,
    uuid: 'bp_palworld_dedicated',
    name: 'Palworld Dedicated',
    author: 'parkervcp',
    dockerImage: 'ghcr.io/pterodactyl/games:source',
    startupCommand: './PalServer.sh -port={{SERVER_PORT}}',
    stopCommand: 'shutdown 10',
    serversCount: 2,
  },
  {
    id: 4,
    uuid: 'bp_fivem_server',
    name: 'FiveM FXServer',
    author: 'support@pterodactyl.io',
    dockerImage: 'ghcr.io/pterodactyl/games:fivem',
    startupCommand: 'bash /entrypoint.sh',
    stopCommand: 'quit',
    serversCount: 3,
  },
];

export const demoAllocations = [
  { id: 1, nodeId: 1, ipAddress: '198.51.100.24', port: 25565, alias: 'mc.octopus.network', serverId: 1, isPrimary: true, node: { name: 'Node-DE-Frankfurt-01' } },
  { id: 2, nodeId: 1, ipAddress: '198.51.100.24', port: 28015, alias: 'rust.octopus.network', serverId: 2, isPrimary: true, node: { name: 'Node-DE-Frankfurt-01' } },
  { id: 3, nodeId: 1, ipAddress: '198.51.100.24', port: 30120, alias: 'fivem.octopus.network', serverId: 4, isPrimary: true, node: { name: 'Node-DE-Frankfurt-01' } },
  { id: 4, nodeId: 2, ipAddress: '198.51.100.88', port: 8211, alias: 'pal.octopus.network', serverId: 3, isPrimary: true, node: { name: 'Node-FR-Paris-01' } },
  { id: 5, nodeId: 1, ipAddress: '198.51.100.24', port: 25566, alias: null, serverId: null, isPrimary: false, node: { name: 'Node-DE-Frankfurt-01' } },
  { id: 6, nodeId: 1, ipAddress: '198.51.100.24', port: 25567, alias: null, serverId: null, isPrimary: false, node: { name: 'Node-DE-Frankfurt-01' } },
  { id: 7, nodeId: 2, ipAddress: '198.51.100.88', port: 8212, alias: null, serverId: null, isPrimary: false, node: { name: 'Node-FR-Paris-01' } },
  { id: 8, nodeId: 3, ipAddress: '198.51.100.150', port: 27015, alias: 'cs2.octopus.network', serverId: null, isPrimary: false, node: { name: 'Node-US-NewYork-01' } },
];

export const demoServers = [
  {
    id: 1,
    uuid: 'srv_mc_121-paper-0001',
    identifier: 'mc-paper',
    name: 'Minecraft Paper 1.21.4 (Survival)',
    userId: 1,
    nodeId: 1,
    blueprintId: 1,
    allocationId: 1,
    memory: 4096,
    cpu: 200,
    disk: 35840,
    isSuspended: false,
    status: ServerStatus.RUNNING,
    node: { id: 1, name: 'Node-DE-Frankfurt-01', fqdn: 'de-01.octopus.network', apiPort: 8080 },
    allocation: { id: 1, ipAddress: '198.51.100.24', port: 25565, isPrimary: true },
    blueprint: { id: 1, name: 'Paper Minecraft 1.21.4', dockerImage: 'ghcr.io/pterodactyl/yolks:java_21' },
  },
  {
    id: 2,
    uuid: 'srv_rust_main-0002',
    identifier: 'rust-main',
    name: 'Rust Vanilla 2x (Monthly Wipe)',
    userId: 1,
    nodeId: 1,
    blueprintId: 2,
    allocationId: 2,
    memory: 8192,
    cpu: 400,
    disk: 61440,
    isSuspended: false,
    status: ServerStatus.RUNNING,
    node: { id: 1, name: 'Node-DE-Frankfurt-01', fqdn: 'de-01.octopus.network', apiPort: 8080 },
    allocation: { id: 2, ipAddress: '198.51.100.24', port: 28015, isPrimary: true },
    blueprint: { id: 2, name: 'Rust Dedicated Server', dockerImage: 'ghcr.io/pterodactyl/games:rust' },
  },
  {
    id: 3,
    uuid: 'srv_palworld_ded-0003',
    identifier: 'palworld',
    name: 'Palworld Community Dedicated',
    userId: 1,
    nodeId: 2,
    blueprintId: 3,
    allocationId: 4,
    memory: 16384,
    cpu: 400,
    disk: 51200,
    isSuspended: false,
    status: ServerStatus.STARTING,
    node: { id: 2, name: 'Node-FR-Paris-01', fqdn: 'fr-01.octopus.network', apiPort: 8080 },
    allocation: { id: 4, ipAddress: '198.51.100.88', port: 8211, isPrimary: true },
    blueprint: { id: 3, name: 'Palworld Dedicated', dockerImage: 'ghcr.io/pterodactyl/games:source' },
  },
  {
    id: 4,
    uuid: 'srv_fivem_rp-0004',
    identifier: 'fivem-rp',
    name: 'FiveM Los Santos Roleplay',
    userId: 1,
    nodeId: 1,
    blueprintId: 4,
    allocationId: 3,
    memory: 12288,
    cpu: 300,
    disk: 81920,
    isSuspended: false,
    status: ServerStatus.OFFLINE,
    node: { id: 1, name: 'Node-DE-Frankfurt-01', fqdn: 'de-01.octopus.network', apiPort: 8080 },
    allocation: { id: 3, ipAddress: '198.51.100.24', port: 30120, isPrimary: true },
    blueprint: { id: 4, name: 'FiveM FXServer', dockerImage: 'ghcr.io/pterodactyl/games:fivem' },
  },
];

export const demoUsers = [
  { id: 1, uuid: 'usr_001', username: 'DemoAdmin', email: 'admin@octopuspanel.io', role: UserRole.ADMIN, languagePreference: 'en', createdAt: '2026-01-10T12:00:00Z' },
  { id: 2, uuid: 'usr_002', username: 'AlexHoster', email: 'alex@hostcloud.eu', role: UserRole.ADMIN, languagePreference: 'de', createdAt: '2026-02-15T14:30:00Z' },
  { id: 3, uuid: 'usr_003', username: 'GameDevMax', email: 'max@studio-craft.net', role: UserRole.USER, languagePreference: 'en', createdAt: '2026-03-01T09:15:00Z' },
  { id: 4, uuid: 'usr_004', username: 'CloudCustomer', email: 'user@gmail.com', role: UserRole.USER, languagePreference: 'de', createdAt: '2026-03-20T18:00:00Z' },
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
};
