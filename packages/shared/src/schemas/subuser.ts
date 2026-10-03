import { z } from 'zod';

export const SubuserPermissions = [
  'websocket.connect',
  'control.start',
  'control.stop',
  'control.restart',
  'user.create',
  'user.read',
  'user.update',
  'user.delete',
  'file.create',
  'file.read',
  'file.update',
  'file.delete',
  'file.archive',
  'file.sftp',
  'allocation.read',
  'allocation.create',
  'allocation.update',
  'allocation.delete',
  'startup.read',
  'startup.update',
  'database.create',
  'database.read',
  'database.update',
  'database.delete',
  'database.view_password',
  'schedule.create',
  'schedule.read',
  'schedule.update',
  'schedule.delete',
  'settings.rename',
  'settings.reinstall',
] as const;

export type SubuserPermission = (typeof SubuserPermissions)[number];

export const SubuserSchema = z.object({
  id: z.number().int().positive(),
  serverId: z.number().int().positive(),
  userId: z.number().int().positive(),
  permissions: z.array(z.string()).default([]),
  createdAt: z.date(),
});

export type Subuser = z.infer<typeof SubuserSchema>;

export const CreateSubuserSchema = z.object({
  email: z.string().email(),
  permissions: z.array(z.string()).min(1),
});

export type CreateSubuserInput = z.infer<typeof CreateSubuserSchema>;

export const UpdateSubuserSchema = z.object({
  permissions: z.array(z.string()).min(1),
});

export type UpdateSubuserInput = z.infer<typeof UpdateSubuserSchema>;
