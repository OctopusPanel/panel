import { z } from 'zod';

export const AllocationSchema = z.object({
  id: z.number().int().positive(),
  nodeId: z.number().int().positive(),
  ipAddress: z.string().ip(),
  port: z.number().int().min(1).max(65535),
  alias: z.string().nullable().optional(),
  serverId: z.number().int().positive().nullable().optional(),
  isPrimary: z.boolean().default(false),
  assigned: z.boolean().default(false),
});

export type Allocation = z.infer<typeof AllocationSchema>;

export const CreateAllocationSchema = z.object({
  nodeId: z.number().int().positive(),
  ipAddress: z.string().ip(),
  port: z.number().int().min(1).max(65535),
  alias: z.string().optional(),
});

export type CreateAllocationInput = z.infer<typeof CreateAllocationSchema>;

export const CreateAllocationRangeSchema = z.object({
  nodeId: z.number().int().positive(),
  ipAddress: z.string().ip(),
  startPort: z.number().int().min(1).max(65535),
  endPort: z.number().int().min(1).max(65535),
  alias: z.string().optional(),
}).refine((data) => data.startPort <= data.endPort, {
  message: 'startPort must be less than or equal to endPort',
  path: ['endPort'],
});

export type CreateAllocationRangeInput = z.infer<typeof CreateAllocationRangeSchema>;
