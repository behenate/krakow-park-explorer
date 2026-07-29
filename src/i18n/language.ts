import { getLocales } from 'expo-localization';

import { Language, translations } from './translations';

/** The persisted setting: an explicit language, or "follow the device". */
export type LanguageSetting = Language | 'system';

/** Explicit languages, in the order the pickers cycle through them. */
export const LANGUAGE_CYCLE: Language[] = ['pl', 'en', 'uk'];

export const LANGUAGE_ORDER: LanguageSetting[] = ['system', ...LANGUAGE_CYCLE];

/** Endonyms — a language picker should read in its own language. */
export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  pl: 'Polski',
  uk: 'Українська',
};

const LOCALE_TAGS: Record<Language, string> = {
  en: 'en-GB',
  pl: 'pl-PL',
  uk: 'uk-UA',
};

/**
 * Resolve the setting to a concrete language. `getLocales()` reports an IETF
 * BCP 47 language code without the region, so 'uk-UA' and plain 'uk' both
 * arrive as 'uk' — a direct lookup is enough.
 */
export function resolveLanguage(setting: LanguageSetting): Language {
  if (setting !== 'system') return setting;
  const code = getLocales()[0]?.languageCode;
  return code && code in translations ? (code as Language) : 'en';
}

/** BCP 47 tag for Intl / toLocaleDateString. */
export function localeTag(lang: Language): string {
  return LOCALE_TAGS[lang];
}
