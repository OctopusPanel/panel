import { z } from 'zod';

export const EggVariableSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  envVariable: z.string().regex(/^[a-zA-Z0-9_]+$/, 'Environment variable must be valid identifier'),
  defaultValue: z.string().default(''),
  userViewable: z.boolean().default(true),
  userEditable: z.boolean().default(true),
  rules: z.string().default('nullable|string'),
});

export type EggVariable = z.infer<typeof EggVariableSchema>;

export const EggConfigFileSchema = z.object({
  file: z.string(),
  parser: z.enum(['file', 'yaml', 'json', 'properties', 'ini']).default('file'),
  findAndReplace: z.record(z.string(), z.string()).optional(),
  insertAfter: z.record(z.string(), z.string()).optional(),
});

export type EggConfigFile = z.infer<typeof EggConfigFileSchema>;

export const BlueprintSchema = z.object({
  id: z.number().int().positive(),
  uuid: z.string().uuid(),
  name: z.string().min(1).max(128),
  author: z.string().max(128).default('OctopusPanel'),
  description: z.string().optional(),
  dockerImage: z.string().min(1),
  dockerImages: z.record(z.string(), z.string()).optional(),
  startupCommand: z.string().min(1),
  stopCommand: z.string().default('^C'),
  configFiles: z.record(z.string(), EggConfigFileSchema).default({}),
  variables: z.array(EggVariableSchema).default([]),
  installScript: z.string().nullable().optional(),
  installContainer: z.string().nullable().optional(),
  installEntrypoint: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;

export const CreateBlueprintSchema = z.object({
  name: z.string().min(1).max(128),
  author: z.string().max(128).default('OctopusPanel'),
  description: z.string().optional(),
  dockerImage: z.string().min(1),
  dockerImages: z.record(z.string(), z.string()).optional(),
  startupCommand: z.string().min(1),
  stopCommand: z.string().default('^C'),
  configFiles: z.record(z.string(), EggConfigFileSchema).default({}),
  variables: z.array(EggVariableSchema).default([]),
  installScript: z.string().optional(),
  installContainer: z.string().optional(),
  installEntrypoint: z.string().optional(),
});

export type CreateBlueprintInput = z.infer<typeof CreateBlueprintSchema>;

export const UpdateBlueprintSchema = CreateBlueprintSchema.partial();
export type UpdateBlueprintInput = z.infer<typeof UpdateBlueprintSchema>;

/**
 * Schema for standard Pterodactyl Egg export files (egg-*.json)
 */
export const PterodactylEggFileSchema = z.object({
  meta: z.object({
    version: z.string(),
    update_url: z.string().nullable().optional(),
  }),
  name: z.string(),
  author: z.string(),
  description: z.string().nullable().optional(),
  features: z.array(z.string()).nullable().optional(),
  docker_images: z.record(z.string(), z.string()).optional(),
  image: z.string().optional(),
  startup: z.string(),
  config: z
    .object({
      files: z.record(z.string(), z.any()).optional(),
      startup: z
        .object({
          done: z.union([z.string(), z.array(z.string())]).optional(),
          userInteraction: z.array(z.string()).optional(),
        })
        .optional(),
      stop: z.string().optional(),
      logs: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
  scripts: z
    .object({
      installation: z
        .object({
          script: z.string().optional(),
          container: z.string().optional(),
          entrypoint: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  variables: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().nullable().optional(),
        env_variable: z.string(),
        default_value: z.union([z.string(), z.number()]).default(''),
        user_viewable: z.union([z.boolean(), z.number()]).default(true),
        user_editable: z.union([z.boolean(), z.number()]).default(true),
        rules: z.string().default('nullable|string'),
      }),
    )
    .optional(),
});

export type PterodactylEggFile = z.infer<typeof PterodactylEggFileSchema>;
