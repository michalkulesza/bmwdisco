import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';
export type LanguageChoice = 'system' | 'en' | 'pl';
export type AdapterChoice = 'enet' | 'thor' | 'vgate' | 'demo';

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];
export const LANGUAGE_CHOICES: readonly LanguageChoice[] = ['system', 'en', 'pl'];
export const ADAPTER_CHOICES: readonly AdapterChoice[] = ['enet', 'thor', 'vgate', 'demo'];

const syncStorage: StateStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => Storage.removeItemSync(key),
};

interface SettingsState {
  theme: ThemeMode;
  language: LanguageChoice;
  adapter: AdapterChoice;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: LanguageChoice) => void;
  setAdapter: (adapter: AdapterChoice) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'system',
      adapter: 'enet',
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setAdapter: (adapter) => set({ adapter }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => syncStorage),
      partialize: ({ theme, language, adapter }) => ({ theme, language, adapter }),
    },
  ),
);
