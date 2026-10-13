import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { useSettingsStore, type LanguageChoice } from '@/stores/settings';

import en from './en.json';
import pl from './pl.json';

export type AppLanguage = 'en' | 'pl';

export const FALLBACK_LANGUAGE: AppLanguage = 'en';

const isAppLanguage = (code: string | null | undefined): code is AppLanguage =>
  code === 'en' || code === 'pl';

export const resolveLanguage = (choice: LanguageChoice): AppLanguage => {
  if (choice !== 'system') return choice;
  const deviceCode = getLocales()[0]?.languageCode;
  return isAppLanguage(deviceCode) ? deviceCode : FALLBACK_LANGUAGE;
};

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, pl: { translation: pl } },
  lng: resolveLanguage(useSettingsStore.getState().language),
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: { escapeValue: false },
  initAsync: false,
});

useSettingsStore.subscribe((state, previous) => {
  if (state.language === previous.language) return;
  void i18n.changeLanguage(resolveLanguage(state.language));
});

export default i18n;
