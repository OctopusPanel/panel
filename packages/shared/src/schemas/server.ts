import { z } from 'zod';
import { PowerAction, ProviderType, ServerStatus } from '../enums/index.js';

export const ServerResourcesSchema = z.object({
  memory: z.number().int().positive(), // in MB
  cpu: z.number().int().nonnegative(), // percentage limit (e.g. 100 = 1 core, 200 = 2 cores, 0 = unlimited)
  disk: z.number().int().positive(), // in MB
  swap: z.number().int().nonnegative().default(0), // in MB (-1 = unlimited, 0 = disabled)
  io: z.number().int().min(10).max(1000).default(500),
});

export type ServerResources = z.infer<typeof ServerResourcesSchema>;

export const ServerSchema = z.object({
  id: z.number().int().positive(),
  uuid: z.string().uuid(),
  identifier: z.string().length(8),
  name: z.string().min(1).max(64),
  description: z.string().nullable().optional(),
  userId: z.number().int().positive(),
  nodeId: z.number().int().positive(),
  blueprintId: z.number().int().positive(),
  allocationId: z.number().int().positive().nullable().optional(),
  memory: z.number().int().positive(), // in MB
  cpu: z.number().int().nonnegative(), // in %
  disk: z.number().int().positive(), // in MB
  swap: z.number().int().nonnegative().default(0),
  io: z.number().int().default(500),
  isSuspended: z.boolean().default(false),
  status: z.nativeEnum(ServerStatus).default(ServerStatus.OFFLINE),
  providerType: z.nativeEnum(ProviderType).default(ProviderType.TENTACLE_DOCKER),
  dockerImage: z.string(),
  startupCommand: z.string(),
  environment: z.record(z.string(), z.string()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Server = z.infer<typeof ServerSchema>;

export const CreateServerSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().optional(),
  userId: z.number().int().positive(),
  nodeId: z.number().int().positive(),
  blueprintId: z.number().int().positive(),
  allocationId: z.number().int().positive().optional(),
  memory: z.number().int().positive(),
  cpu: z.number().int().nonnegative().default(100),
  disk: z.number().int().positive(),
  swap: z.number().int().nonnegative().default(0),
  io: z.number().int().default(500),
  providerType: z.nativeEnum(ProviderType).default(ProviderType.TENTACLE_DOCKER),
  dockerImage: z.string().optional(),
  startupCommand: z.string().optional(),
  environment: z.record(z.string(), z.string()).default({}),
  startOnCompletion: z.boolean().default(true),
});

export type CreateServerInput = z.infer<typeof CreateServerSchema>;

export const UpdateServerSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().optional(),
  memory: z.number().int().positive().optional(),
  cpu: z.number().int().nonnegative().optional(),
  disk: z.number().int().positive().optional(),
  swap: z.number().int().nonnegative().optional(),
  io: z.number().int().optional(),
  dockerImage: z.string().optional(),
  startupCommand: z.string().optional(),
  environment: z.record(z.string(), z.string()).optional(),
  isSuspended: z.boolean().optional(),
});

export type UpdateServerInput = z.infer<typeof UpdateServerSchema>;

export const ServerPowerActionSchema = z.object({
  action: z.nativeEnum(PowerAction),
});

export type ServerPowerActionInput = z.infer<typeof ServerPowerActionSchema>;

export const ServerMetricsSchema = z.object({
  currentState: z.nativeEnum(ServerStatus),
  isSuspended: z.boolean(),
  resources: z.object({
    memoryBytes: z.number(),
    memoryLimitBytes: z.number(),
    cpuAbsolute: z.number(),
    diskBytes: z.number(),
    networkRxBytes: z.number(),
    networkTxBytes: z.number(),
    uptimeMs: z.number(),
  }),
});

export type ServerMetrics = z.infer<typeof ServerMetricsSchema>;
