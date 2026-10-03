import { HookRegistry } from './events/index.js';
import { UiSlotItem, UiSlotRegistry } from './ui/index.js';
import { ServerProviderDriver, ProviderRegistry } from './drivers/index.js';

export interface ModuleContext {
  hooks: HookRegistry;
  uiSlots: UiSlotRegistry;
  providers: ProviderRegistry;
  registerTranslations: (translations: Record<string, Record<string, unknown>>) => void;
  config: Record<string, unknown>;
}

export interface OctopusModule {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;

  // Lifecycle
  onLoad?(context: ModuleContext): Promise<void> | void;
  onUnload?(): Promise<void> | void;

  // Declarative extensions
  slots?: UiSlotItem[];
  drivers?: ServerProviderDriver[];
}

export function defineModule(module: OctopusModule): OctopusModule {
  return module;
}
