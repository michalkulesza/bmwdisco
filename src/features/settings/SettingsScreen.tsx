import { router } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { isOnlinePhase } from '@/features/connect/helpers';
import { useSessionPhase } from '@/session';
import { THEME_MODES, useSettingsStore } from '@/stores/settings';
import Copyright from '@/ui/Copyright';
import ListGroup from '@/ui/ListGroup';
import ListRow from '@/ui/ListRow';
import Screen from '@/ui/Screen';
import SectionHeader from '@/ui/SectionHeader';
import SegmentedControl from '@/ui/SegmentedControl';
import Text from '@/ui/Text';

import ConnectedSections from './ConnectedSections';
import DiagnosticsSection from './DiagnosticsSection';

const CableSection = () => {
  const { t } = useTranslation();
  const adapter = useSettingsStore((state) => state.adapter);

  const handleCablePress = useCallback(() => router.push('/settings/cable'), []);

  return (
    <View className="gap-3">
      <SectionHeader title={t('settings.connection')} />
      <ListGroup>
        <ListRow
          label={t('settings.cable')}
          value={t(`cable.adapters.${adapter}.name`)}
          chevron
          onPress={handleCablePress}
        />
      </ListGroup>
    </View>
  );
};

const AppearanceSection = () => {
  const { t } = useTranslation();
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const options = THEME_MODES.map((mode) => ({
    value: mode,
    label: t(`settings.themeOptions.${mode}`),
  }));

  return (
    <View className="gap-3">
      <SectionHeader title={t('settings.appearance')} />
      <View className="flex-row items-center gap-3 rounded-card border border-card-border bg-card py-3 pl-4 pr-3">
        <Text variant="bodyMedium" className="flex-1">
          {t('settings.theme')}
        </Text>
        <SegmentedControl
          options={options}
          value={theme}
          onChange={setTheme}
          accessibilityLabel={t('settings.theme')}
          className="w-[210px]"
        />
      </View>
    </View>
  );
};

const LanguageSection = () => {
  const { t } = useTranslation();
  const language = useSettingsStore((state) => state.language);

  const handleLanguagePress = useCallback(() => router.push('/settings/language'), []);

  return (
    <View className="gap-3">
      <SectionHeader title={t('settings.language')} />
      <ListGroup>
        <ListRow
          label={t('settings.appLanguage')}
          value={t(`settings.languageOptions.${language}`)}
          chevron
          onPress={handleLanguagePress}
        />
      </ListGroup>
    </View>
  );
};

const SettingsScreen = () => {
  const online = isOnlinePhase(useSessionPhase());

  return (
    <Screen>
      {online ? <ConnectedSections /> : <CableSection />}
      <AppearanceSection />
      <LanguageSection />
      <DiagnosticsSection />
      <Copyright />
    </Screen>
  );
};

export default SettingsScreen;
