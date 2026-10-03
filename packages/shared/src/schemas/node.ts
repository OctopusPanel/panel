import { z } from 'zod';

export const NodeSchema = z.object({
  id: z.number().int().positive(),
  uuid: z.string().uuid(),
  name: z.string().min(1).max(64),
  fqdn: z.string().min(1).max(255),
  apiPort: z.number().int().min(1).max(65535).default(8080),
  sftpPort: z.number().int().min(1).max(65535).default(2022),
  memoryLimit: z.number().int().nonnegative(), // in MB
  diskLimit: z.number().int().nonnegative(), // in MB
  isMaintenance: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Node = z.infer<typeof NodeSchema>;

export const CreateNodeSchema = z.object({
  name: z.string().min(1).max(64),
  fqdn: z.string().min(1).max(255),
  apiPort: z.number().int().min(1).max(65535).default(8080),
  sftpPort: z.number().int().min(1).max(65535).default(2022),
  memoryLimit: z.number().int().positive(), // in MB
  diskLimit: z.number().int().positive(), // in MB
  isMaintenance: z.boolean().default(false),
});

export type CreateNodeInput = z.infer<typeof CreateNodeSchema>;

export const UpdateNodeSchema = CreateNodeSchema.partial();
export type UpdateNodeInput = z.infer<typeof UpdateNodeSchema>;

export const NodeHealthSchema = z.object({
  isOnline: z.boolean(),
  version: z.string().optional(),
  system: z
    .object({
      os: z.string().optional(),
      kernel: z.string().optional(),
      uptimeSeconds: z.number().optional(),
      cpuCores: z.number().optional(),
      cpuUsagePercent: z.number().optional(),
      memoryTotalMb: z.number().optional(),
      memoryUsedMb: z.number().optional(),
      diskTotalMb: z.number().optional(),
      diskUsedMb: z.number().optional(),
    })
    .optional(),
  lastCheckedAt: z.date(),
});

export type NodeHealth = z.infer<typeof NodeHealthSchema>;

export const NodeSetupCommandSchema = z.object({
  command: z.string(),
  token: z.string(),
  expiresAt: z.date(),
});

export type NodeSetupCommand = z.infer<typeof NodeSetupCommandSchema>;
