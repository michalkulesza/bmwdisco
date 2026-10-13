import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ADAPTER_CHOICES, useSettingsStore } from '@/stores/settings';
import Screen from '@/ui/Screen';
import Text from '@/ui/Text';

import AdapterOption from './AdapterOption';

const CableScreen = () => {
  const { t } = useTranslation();
  const adapter = useSettingsStore((state) => state.adapter);
  const setAdapter = useSettingsStore((state) => state.setAdapter);

  return (
    <Screen keyboardAware>
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
