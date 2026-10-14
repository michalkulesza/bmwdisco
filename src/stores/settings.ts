import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';
export type LanguageChoice = 'system' | 'en' | 'pl';
export type AdapterChoice = 'enet' | 'thor' | 'vgate' | 'demo';

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];
export const LANGUAGE_CHOICES: readonly LanguageChoice[] = ['system', 'en', 'pl'];
export const ADAPTER_CHOICES: readonly AdapterChoice[] = ['enet', 'thor', 'vgate', 'demo'];

export const DEFAULT_THOR_HOST = '192.168.0.10';
export const DEFAULT_THOR_PORT = '23';
export const DEFAULT_DEMO_CHASSIS = 'F32';

export interface BleDevice {
  id: string;
  name: string | null;
}

const syncStorage: StateStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => Storage.removeItemSync(key),
};

export interface AdapterSettings {
  adapter: AdapterChoice;
  enetHost: string;
  lastEnetHost: string;
  thorHost: string;
  thorPort: string;
  icarDevice: BleDevice | null;
  demoChassis: string;
}

interface SettingsState extends AdapterSettings {
  theme: ThemeMode;
  language: LanguageChoice;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: LanguageChoice) => void;
  setAdapter: (adapter: AdapterChoice) => void;
  setEnetHost: (enetHost: string) => void;
  setLastEnetHost: (lastEnetHost: string) => void;
  setThorHost: (thorHost: string) => void;
  setThorPort: (thorPort: string) => void;
  setIcarDevice: (icarDevice: BleDevice | null) => void;
  setDemoChassis: (demoChassis: string) => void;
}

export const selectAdapterSettings = ({
  adapter,
  enetHost,
  lastEnetHost,
  thorHost,
  thorPort,
  icarDevice,
  demoChassis,
}: SettingsState): AdapterSettings => ({
  adapter,
  enetHost,
  lastEnetHost,
  thorHost,
  thorPort,
  icarDevice,
  demoChassis,
});

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'system',
      adapter: 'enet',
      enetHost: '',
      lastEnetHost: '',
      thorHost: DEFAULT_THOR_HOST,
      thorPort: DEFAULT_THOR_PORT,
      icarDevice: null,
      demoChassis: DEFAULT_DEMO_CHASSIS,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setAdapter: (adapter) => set({ adapter }),
      setEnetHost: (enetHost) => set({ enetHost }),
      setLastEnetHost: (lastEnetHost) => set({ lastEnetHost }),
      setThorHost: (thorHost) => set({ thorHost }),
      setThorPort: (thorPort) => set({ thorPort }),
      setIcarDevice: (icarDevice) => set({ icarDevice }),
      setDemoChassis: (demoChassis) => set({ demoChassis }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => syncStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        ...selectAdapterSettings(state),
      }),
    },
  ),
);
