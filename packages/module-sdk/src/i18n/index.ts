export type TranslationDictionary = Record<string, unknown>;

export interface ModuleTranslations {
  [locale: string]: TranslationDictionary;
}

class ModuleI18nRegistry {
  private translations = new Map<string, ModuleTranslations>();

  register(moduleId: string, translations: ModuleTranslations): void {
    const existing = this.translations.get(moduleId) || {};
    for (const [locale, dict] of Object.entries(translations)) {
      existing[locale] = {
        ...(existing[locale] || {}),
        ...dict,
      };
    }
    this.translations.set(moduleId, existing);
  }

  getForLocale(locale: string): Record<string, TranslationDictionary> {
    const result: Record<string, TranslationDictionary> = {};
    for (const [moduleId, bundles] of this.translations.entries()) {
      if (bundles[locale]) {
        result[moduleId] = bundles[locale];
      } else if (bundles['en']) {
        // Fallback to English
        result[moduleId] = bundles['en'];
      }
    }
    return result;
  }

  getAll(): Map<string, ModuleTranslations> {
    return this.translations;
  }
}

export const globalI18nRegistry = new ModuleI18nRegistry();

export function registerModuleTranslations(moduleId: string, translations: ModuleTranslations): void {
  globalI18nRegistry.register(moduleId, translations);
}

export function getModuleTranslations(locale: string): Record<string, TranslationDictionary> {
  return globalI18nRegistry.getForLocale(locale);
}
