import { useSettingsStore } from './settings';

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
});
