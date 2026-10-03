import { z } from 'zod';

export const ModuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  isEnabled: z.boolean().default(false),
  config: z.record(z.string(), z.any()).default({}),
  installedAt: z.date(),
});

export type Module = z.infer<typeof ModuleSchema>;

export const UpdateModuleConfigSchema = z.object({
  config: z.record(z.string(), z.any()),
});

export type UpdateModuleConfigInput = z.infer<typeof UpdateModuleConfigSchema>;

export const ToggleModuleSchema = z.object({
  enabled: z.boolean(),
});

export type ToggleModuleInput = z.infer<typeof ToggleModuleSchema>;
