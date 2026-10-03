export enum ServerStatus {
  INSTALLING = 'installing',
  OFFLINE = 'offline',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  SUSPENDED = 'suspended',
  ERROR = 'error',
}

export enum UserRole {
  ADMIN = 'admin',
  SUPPORT = 'support',
  USER = 'user',
}

export enum PowerAction {
  START = 'start',
  STOP = 'stop',
  RESTART = 'restart',
  KILL = 'kill',
}

export enum ProviderType {
  TENTACLE_DOCKER = 'tentacle-docker',
  PROXMOX_LXC = 'proxmox-lxc',
  PROXMOX_KVM = 'proxmox-kvm',
  KUBERNETES = 'kubernetes',
  CUSTOM = 'custom',
}

export enum AuditAction {
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_REGISTER = 'user.register',
  USER_UPDATE = 'user.update',
  SERVER_CREATE = 'server.create',
  SERVER_UPDATE = 'server.update',
  SERVER_DELETE = 'server.delete',
  SERVER_POWER = 'server.power',
  SERVER_SUSPEND = 'server.suspend',
  SERVER_UNSUSPEND = 'server.unsuspend',
  NODE_CREATE = 'node.create',
  NODE_UPDATE = 'node.update',
  NODE_DELETE = 'node.delete',
  BLUEPRINT_CREATE = 'blueprint.create',
  BLUEPRINT_UPDATE = 'blueprint.update',
  BLUEPRINT_DELETE = 'blueprint.delete',
  MODULE_INSTALL = 'module.install',
  MODULE_ENABLE = 'module.enable',
  MODULE_DISABLE = 'module.disable',
}
