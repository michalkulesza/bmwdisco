import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';
export type LanguageChoice = 'system' | 'en' | 'pl';
export type AdapterChoice = 'enet' | 'thor' | 'vgate' | 'demo' | 'elmBluetooth' | 'elmWifi' | 'usb';

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];
export const LANGUAGE_CHOICES: readonly LanguageChoice[] = ['system', 'en', 'pl'];
export const adapterChoicesForPlatform = (platform: string): readonly AdapterChoice[] =>
  platform === 'android'
    ? ['enet', 'thor', 'vgate', 'elmBluetooth', 'elmWifi', 'usb', 'demo']
    : ['enet', 'thor', 'vgate', 'demo'];
export const ADAPTER_CHOICES = adapterChoicesForPlatform(Platform.OS);
export const DEFAULT_ELM_WIFI_HOST = '192.168.0.10';
export const DEFAULT_ELM_WIFI_PORT = '35000';

export const DEFAULT_THOR_HOST = Platform.OS === 'android' ? '192.168.4.1' : '192.168.0.10';
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
  elmBluetoothDevice?: BleDevice | null;
  usbDevice?: BleDevice | null;
  elmWifiHost?: string;
  elmWifiPort?: string;
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
  setElmBluetoothDevice: (device: BleDevice | null) => void;
  setUsbDevice: (device: BleDevice | null) => void;
  setElmWifiHost: (host: string) => void;
  setElmWifiPort: (port: string) => void;
  setDemoChassis: (demoChassis: string) => void;
}

export const selectAdapterSettings = ({
  adapter,
  enetHost,
  lastEnetHost,
  thorHost,
  thorPort,
  icarDevice,
  elmBluetoothDevice,
  usbDevice,
  elmWifiHost,
  elmWifiPort,
  demoChassis,
}: SettingsState): AdapterSettings => ({
  adapter,
  enetHost,
  lastEnetHost,
  thorHost,
  thorPort,
  icarDevice,
  elmBluetoothDevice,
  usbDevice,
  elmWifiHost,
  elmWifiPort,
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
      elmBluetoothDevice: null,
      usbDevice: null,
      elmWifiHost: DEFAULT_ELM_WIFI_HOST,
      elmWifiPort: DEFAULT_ELM_WIFI_PORT,
      demoChassis: DEFAULT_DEMO_CHASSIS,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setAdapter: (adapter) => set({ adapter }),
      setEnetHost: (enetHost) => set({ enetHost }),
      setLastEnetHost: (lastEnetHost) => set({ lastEnetHost }),
      setThorHost: (thorHost) => set({ thorHost }),
      setThorPort: (thorPort) => set({ thorPort }),
      setIcarDevice: (icarDevice) => set({ icarDevice }),
      setElmBluetoothDevice: (elmBluetoothDevice) => set({ elmBluetoothDevice }),
      setUsbDevice: (usbDevice) => set({ usbDevice }),
      setElmWifiHost: (elmWifiHost) => set({ elmWifiHost }),
      setElmWifiPort: (elmWifiPort) => set({ elmWifiPort }),
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
