import { PterodactylEggFileSchema, PterodactylEggFile, CreateBlueprintInput } from '@octopus/shared';

export class EggParser {
  /**
   * Parse a JSON string or object representing a Pterodactyl Egg (egg-*.json)
   */
  static parse(jsonOrObject: string | Record<string, unknown>): PterodactylEggFile {
    const raw = typeof jsonOrObject === 'string' ? JSON.parse(jsonOrObject) : jsonOrObject;
    return PterodactylEggFileSchema.parse(raw);
  }

  /**
   * Convert a validated Pterodactyl Egg object into an Octopus Blueprint input format
   */
  static toBlueprintInput(egg: PterodactylEggFile): CreateBlueprintInput {
    // Determine default docker image
    let dockerImage = egg.image || '';
    if (!dockerImage && egg.docker_images && Object.keys(egg.docker_images).length > 0) {
      dockerImage = Object.values(egg.docker_images)[0];
    }
    if (!dockerImage) {
      dockerImage = 'ghcr.io/pterodactyl/yolks:java_21';
    }

    // Process config files
    const configFiles: Record<string, any> = {};
    if (egg.config && egg.config.files) {
      for (const [filename, fileConfig] of Object.entries(egg.config.files)) {
        configFiles[filename] = {
          file: filename,
          parser: (fileConfig as any).parser || 'file',
          findAndReplace: (fileConfig as any).find || {},
        };
      }
    }

    // Process variables
    const variables = (egg.variables || []).map((v) => ({
      name: v.name,
      description: v.description || '',
      envVariable: v.env_variable,
      defaultValue: String(v.default_value ?? ''),
      userViewable: Boolean(v.user_viewable),
      userEditable: Boolean(v.user_editable),
      rules: v.rules || 'nullable|string',
    }));

    return {
      name: egg.name,
      author: egg.author || 'Pterodactyl Community',
      description: egg.description || undefined,
      dockerImage,
      dockerImages: egg.docker_images || {},
      startupCommand: egg.startup,
      stopCommand: egg.config?.stop || '^C',
      configFiles,
      variables,
      installScript: egg.scripts?.installation?.script,
      installContainer: egg.scripts?.installation?.container,
      installEntrypoint: egg.scripts?.installation?.entrypoint,
    };
  }
}
