import Storage from 'expo-sqlite/kv-store';

import {
  DEFAULT_DEMO_CHASSIS,
  DEFAULT_THOR_HOST,
  DEFAULT_THOR_PORT,
  selectAdapterSettings,
  useSettingsStore,
} from './settings';

describe('settings store', () => {
  it('defaults to system theme and language with the ENET adapter', () => {
    const { theme, language, adapter } = useSettingsStore.getState();

    expect({ theme, language, adapter }).toEqual({
      theme: 'system',
      language: 'system',
      adapter: 'enet',
    });
  });

  it('updates each setting', () => {
    const { setTheme, setLanguage, setAdapter } = useSettingsStore.getState();

    setTheme('dark');
    setLanguage('pl');
    setAdapter('demo');

    const { theme, language, adapter } = useSettingsStore.getState();
    expect({ theme, language, adapter }).toEqual({
      theme: 'dark',
      language: 'pl',
      adapter: 'demo',
    });
  });

  it('keeps migration-safe adapter defaults', () => {
    expect(selectAdapterSettings(useSettingsStore.getState())).toMatchObject({
      enetHost: '',
      lastEnetHost: '',
      thorHost: DEFAULT_THOR_HOST,
      thorPort: DEFAULT_THOR_PORT,
      icarDevice: null,
      demoChassis: DEFAULT_DEMO_CHASSIS,
    });
  });

  it('updates the per-adapter configuration', () => {
    const state = useSettingsStore.getState();

    state.setEnetHost('169.254.10.2');
    state.setThorHost('192.168.1.5');
    state.setThorPort('35000');
    state.setIcarDevice({ id: 'AA:BB', name: 'Vgate' });
    state.setDemoChassis('F10');

    expect(selectAdapterSettings(useSettingsStore.getState())).toMatchObject({
      enetHost: '169.254.10.2',
      thorHost: '192.168.1.5',
      thorPort: '35000',
      icarDevice: { id: 'AA:BB', name: 'Vgate' },
      demoChassis: 'F10',
    });
  });

  it('records the last working ENET host and persists it', () => {
    useSettingsStore.getState().setLastEnetHost('169.254.10.20');

    expect(useSettingsStore.getState().lastEnetHost).toBe('169.254.10.20');
    expect(JSON.parse(Storage.getItemSync('settings')!).state.lastEnetHost).toBe('169.254.10.20');
  });

  it('loads an old stored state without lastEnetHost', async () => {
    useSettingsStore.setState({ lastEnetHost: '' });
    Storage.setItemSync(
      'settings',
      JSON.stringify({ state: { theme: 'dark', enetHost: '169.254.1.1' }, version: 0 }),
    );
    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState()).toMatchObject({
      theme: 'dark',
      enetHost: '169.254.1.1',
      lastEnetHost: '',
    });
  });
});
