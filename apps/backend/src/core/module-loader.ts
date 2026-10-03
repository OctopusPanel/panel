import { db, modules } from '@octopus/database';
import { eq } from 'drizzle-orm';
import {
  OctopusModule,
  globalHooks,
  globalUiSlots,
  globalProviders,
  registerModuleTranslations,
  ModuleContext,
} from '@octopus/module-sdk';

class ModuleLoader {
  private loadedModules = new Map<string, OctopusModule>();

  /**
   * Register a module definition into the loader
   */
  register(module: OctopusModule): void {
    this.loadedModules.set(module.id, module);
  }

  /**
   * Initialize all enabled modules found in database
   */
  async init(): Promise<void> {
    const dbModules = await db.query.modules.findMany();

    for (const record of dbModules) {
      if (record.isEnabled) {
        await this.enable(record.id, record.config as Record<string, unknown>);
      }
    }
  }

  /**
   * Enable a module by ID
   */
  async enable(moduleId: string, config: Record<string, unknown> = {}): Promise<void> {
    const module = this.loadedModules.get(moduleId);
    if (!module) {
      console.warn(`Module [${moduleId}] is enabled in database but no code definition was registered.`);
      return;
    }

    const context: ModuleContext = {
      hooks: globalHooks,
      uiSlots: globalUiSlots,
      providers: globalProviders,
      registerTranslations: (translations) => registerModuleTranslations(moduleId, translations),
      config,
    };

    if (module.slots) {
      for (const slot of module.slots) {
        globalUiSlots.register(slot);
      }
    }

    if (module.drivers) {
      for (const driver of module.drivers) {
        globalProviders.register(driver);
      }
    }

    if (module.onLoad) {
      await module.onLoad(context);
    }

    await db
      .update(modules)
      .set({ isEnabled: true, config })
      .where(eq(modules.id, moduleId));

    console.log(`✅ Module enabled: ${module.name} (${moduleId})`);
  }

  /**
   * Disable a module by ID
   */
  async disable(moduleId: string): Promise<void> {
    const module = this.loadedModules.get(moduleId);
    if (module) {
      if (module.slots) {
        for (const slot of module.slots) {
          globalUiSlots.unregister(slot.id);
        }
      }
      if (module.onUnload) {
        await module.onUnload();
      }
    }

    await db
      .update(modules)
      .set({ isEnabled: false })
      .where(eq(modules.id, moduleId));

    console.log(`ℹ️ Module disabled: ${moduleId}`);
  }

  listLoaded(): OctopusModule[] {
    return Array.from(this.loadedModules.values());
  }
}

export const moduleLoader = new ModuleLoader();
