import { PterodactylEggFileSchema, PterodactylEggFile, CreateBlueprintInput } from '@octopus/shared';

export class EggParser {
  /**
   * Parse a JSON string or object representing a Pterodactyl Egg (egg-*.json)
   */
  static parse(jsonOrObject: string | Record<string, unknown>): PterodactylEggFile {
    let raw: unknown = jsonOrObject;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (err: any) {
        throw new Error(`Invalid JSON syntax in Pterodactyl egg: ${err.message}`);
      }
    }
    return PterodactylEggFileSchema.parse(raw);
  }

  /**
   * Convert a validated Pterodactyl Egg object into an Octopus Blueprint input format
   */
  static toBlueprintInput(egg: PterodactylEggFile): CreateBlueprintInput {
    // Determine default docker image
    let dockerImage = egg.image || '';
    if (!dockerImage && egg.docker_images) {
      if (Array.isArray(egg.docker_images) && egg.docker_images.length > 0) {
        dockerImage = egg.docker_images[0];
      } else if (typeof egg.docker_images === 'object' && Object.keys(egg.docker_images).length > 0) {
        dockerImage = Object.values(egg.docker_images)[0];
      }
    }
    if (!dockerImage) {
      dockerImage = 'ghcr.io/pterodactyl/yolks:java_21';
    }

    // Process docker images map
    const dockerImages: Record<string, string> = {};
    if (egg.docker_images) {
      if (Array.isArray(egg.docker_images)) {
        egg.docker_images.forEach((img, idx) => {
          dockerImages[`Image ${idx + 1}`] = img;
        });
      } else if (typeof egg.docker_images === 'object') {
        Object.assign(dockerImages, egg.docker_images);
      }
    }
    if (Object.keys(dockerImages).length === 0 && dockerImage) {
      dockerImages['Default'] = dockerImage;
    }

    // Process config files
    const configFiles: Record<string, any> = {};
    if (egg.config && egg.config.files) {
      let filesObj = egg.config.files;
      if (typeof filesObj === 'string') {
        try {
          filesObj = JSON.parse(filesObj);
        } catch {
          filesObj = {};
        }
      }

      for (const [filename, fileConfig] of Object.entries(filesObj)) {
        configFiles[filename] = {
          file: filename,
          parser: (fileConfig as any)?.parser || 'file',
          findAndReplace: (fileConfig as any)?.find || {},
        };
      }
    }

    // Process variables
    const variables = (egg.variables || []).map((v) => ({
      name: v.name || 'Variable',
      description: v.description || '',
      envVariable: v.env_variable,
      defaultValue: String(v.default_value ?? ''),
      userViewable: Boolean(v.user_viewable ?? true),
      userEditable: Boolean(v.user_editable ?? true),
      rules: v.rules || 'nullable|string',
    }));

    return {
      name: egg.name,
      author: egg.author || 'Pterodactyl Community',
      description: egg.description || undefined,
      dockerImage,
      dockerImages,
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
