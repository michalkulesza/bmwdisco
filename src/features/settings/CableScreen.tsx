import { router, Stack } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { isConnectablePhase } from '@/features/connect/helpers';
import { useConnectNow } from '@/features/connect/useConnect';
import { headerRightOptions } from '@/features/navigation/headerItems';
import HeaderTextButton from '@/features/preset/PresetEditorScreen/HeaderTextButton';
import { useSessionPhase } from '@/session';
import { ADAPTER_CHOICES, useSettingsStore } from '@/stores/settings';
import { selectionHaptic } from '@/ui/haptics';
import Screen from '@/ui/Screen';
import Text from '@/ui/Text';

import AdapterOption from './AdapterOption';

const CableScreen = () => {
  const { t } = useTranslation();
  const adapter = useSettingsStore((state) => state.adapter);
  const setAdapter = useSettingsStore((state) => state.setAdapter);
  const connectable = isConnectablePhase(useSessionPhase());
  const { canConnect, connectNow } = useConnectNow();

  const handleConnectPress = useCallback(() => {
    selectionHaptic();
    connectNow();
    router.dismissAll();
  }, [connectNow]);

  const connectButton = (
    <HeaderTextButton
      label={t('connect.connect')}
      onPress={handleConnectPress}
      disabled={!canConnect}
      strong
    />
  );
  const connectHeaderOptions = connectable ? headerRightOptions(connectButton) : {};

  return (
    <Screen keyboardAware>
      <Stack.Screen options={connectHeaderOptions} />
      <Text variant="meta" tone="muted">
        {t('cable.description')}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('cable.title')}
        className="gap-2.5"
      >
        {ADAPTER_CHOICES.map((choice) => (
          <AdapterOption
            key={choice}
            choice={choice}
            selected={choice === adapter}
            onSelect={setAdapter}
          />
        ))}
      </View>
    </Screen>
  );
};

export default CableScreen;
