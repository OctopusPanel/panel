import { z } from 'zod';
import { AuditAction } from '../enums/index.js';

export const AuditLogSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive().nullable().optional(),
  action: z.union([z.nativeEnum(AuditAction), z.string()]),
  resourceType: z.string(),
  resourceId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
  ipAddress: z.string().nullable().optional(),
  timestamp: z.date(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

export const CreateAuditLogSchema = z.object({
  userId: z.number().int().positive().nullable().optional(),
  action: z.union([z.nativeEnum(AuditAction), z.string()]),
  resourceType: z.string(),
  resourceId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
  ipAddress: z.string().nullable().optional(),
});

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;
