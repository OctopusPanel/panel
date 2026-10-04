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
  parser: z.string().default('file'),
  findAndReplace: z.record(z.string(), z.any()).optional(),
  insertAfter: z.record(z.string(), z.any()).optional(),
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

const preprocessJson = (val: unknown) => {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '{}') return {};
    try {
      return JSON.parse(trimmed);
    } catch {
      return {};
    }
  }
  return val ?? {};
};

/**
 * Schema for standard Pterodactyl Egg export files (egg-*.json)
 */
export const PterodactylEggFileSchema = z
  .object({
    _comment: z.string().optional(),
    meta: z
      .object({
        version: z.string().optional(),
        update_url: z.string().nullable().optional(),
      })
      .passthrough()
      .optional(),
    exported_at: z.string().optional(),
    name: z.string(),
    author: z.string().optional().default('Pterodactyl Community'),
    description: z.string().nullable().optional(),
    features: z.array(z.string()).nullable().optional(),
    docker_images: z.union([z.record(z.string(), z.string()), z.array(z.string())]).optional(),
    image: z.string().nullable().optional(),
    file_denylist: z.array(z.string()).optional(),
    startup: z.string(),
    config: z
      .object({
        files: z.preprocess(preprocessJson, z.record(z.string(), z.any()).optional().default({})),
        startup: z.preprocess(
          preprocessJson,
          z
            .union([
              z
                .object({
                  done: z.union([z.string(), z.array(z.string())]).optional(),
                  userInteraction: z.array(z.string()).optional(),
                })
                .passthrough(),
              z.record(z.string(), z.any()),
            ])
            .optional()
            .default({}),
        ),
        stop: z.string().optional(),
        logs: z.preprocess(preprocessJson, z.record(z.string(), z.any()).optional().default({})),
      })
      .passthrough()
      .optional(),
    scripts: z
      .object({
        installation: z
          .object({
            script: z.string().optional(),
            container: z.string().optional(),
            entrypoint: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    variables: z
      .array(
        z
          .object({
            name: z.string().default('Variable'),
            description: z.string().nullable().optional(),
            env_variable: z.string(),
            default_value: z
              .union([z.string(), z.number(), z.boolean()])
              .nullable()
              .optional()
              .transform((v) => (v === null || v === undefined ? '' : String(v))),
            user_viewable: z
              .union([z.boolean(), z.number()])
              .nullish()
              .transform((v) => v === true || v === 1),
            user_editable: z
              .union([z.boolean(), z.number()])
              .nullish()
              .transform((v) => v === true || v === 1),
            rules: z
              .string()
              .nullable()
              .optional()
              .transform((v) => v || 'nullable|string'),
            field_type: z.string().nullable().optional(),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
  })
  .passthrough();

export type PterodactylEggFile = z.infer<typeof PterodactylEggFileSchema>;
