import { getLocales } from 'expo-localization';
import React, { createContext, useContext, useMemo } from 'react';

import { useAppStore } from '@/store';
import { Language, TranslationKey, translations } from './translations';

interface I18n {
  lang: Language;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18n | null>(null);

function systemLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code === 'pl' ? 'pl' : 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const setting = useAppStore((s) => s.settings.language);
  const lang: Language = setting === 'system' ? systemLanguage() : setting;

  const value = useMemo<I18n>(
    () => ({
      lang,
      t: (key, vars) => {
        let str: string = translations[lang][key] ?? translations.en[key] ?? key;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, String(v));
        }
        return str;
      },
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
