import { createI18n } from 'vue-i18n';
import en from '../locales/en.json';
import de from '../locales/de.json';
import { ApiErrorDetail } from '@octopus/shared';

const savedLocale = localStorage.getItem('octopus_locale') || (navigator.language.startsWith('de') ? 'de' : 'en');

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    de,
  },
});

export function setLanguage(locale: string): void {
  (i18n.global.locale as any).value = locale;
  localStorage.setItem('octopus_locale', locale);
  document.documentElement.lang = locale;
}

export function registerDynamicModuleTranslations(
  moduleId: string,
  translations: Record<string, Record<string, unknown>>,
): void {
  for (const [locale, messages] of Object.entries(translations)) {
    i18n.global.mergeLocaleMessage(locale, {
      [moduleId]: messages,
    });
  }
}

export function translateApiError(error?: ApiErrorDetail | null): string {
  if (!error) return i18n.global.t('errors.INTERNAL_ERROR');
  const code = error.code || 'INTERNAL_ERROR';
  const key = `errors.${code}`;

  if (i18n.global.te(key)) {
    return i18n.global.t(key, (error.params as any) || {});
  }

  return error.message || code;
}
