import {
  BluetoothConnected,
  Check,
  Network,
  PlayCircle,
  WifiHigh,
  type Icon,
} from 'phosphor-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { AdapterChoice } from '@/stores/settings';
import { selectionHaptic } from '@/ui/haptics';
import IconBadge from '@/ui/IconBadge';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

import AdapterFields from './AdapterFields';

const ADAPTER_ICONS: Record<AdapterChoice, Icon> = {
  enet: Network,
  thor: WifiHigh,
  vgate: BluetoothConnected,
  demo: PlayCircle,
};

const Radio = ({ selected }: { selected: boolean }) => {
  const onPrimary = useColorToken('on-primary');

  if (!selected) return <View className="size-[22px] rounded-pill border-2 border-radio-off" />;

  return (
    <View className="size-[22px] items-center justify-center rounded-pill bg-primary">
      <Check size={14} weight="bold" color={onPrimary} />
    </View>
  );
};

interface AdapterOptionProps {
  choice: AdapterChoice;
  selected: boolean;
  onSelect: (choice: AdapterChoice) => void;
}

const AdapterOption = ({ choice, selected, onSelect }: AdapterOptionProps) => {
  const { t } = useTranslation();
  const cardClass = selected ? 'border-ink bg-raised' : 'border-card-border bg-card';

  const handlePress = useCallback(() => {
    if (selected) return;
    selectionHaptic();
    onSelect(choice);
  }, [choice, onSelect, selected]);

  return (
    <View className={`overflow-hidden rounded-card border-[1.5px] ${cardClass}`}>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={t(`cable.adapters.${choice}.name`)}
        accessibilityHint={t(`cable.adapters.${choice}.description`)}
        accessibilityState={{ checked: selected }}
        onPress={handlePress}
        className="min-h-[84px] flex-row items-center gap-3.5 px-4 py-3.5 active:opacity-80"
      >
        <IconBadge icon={ADAPTER_ICONS[choice]} tone={selected ? 'blue' : 'neutral'} />
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Text variant="labelStrong">{t(`cable.adapters.${choice}.name`)}</Text>
            {choice === 'demo' ? (
              <View className="rounded-pill border border-line px-2 py-0.5">
                <Text variant="tag" className="text-hue-teal">
                  {t('cable.demoBadge')}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="meta" tone="muted">
            {t(`cable.adapters.${choice}.description`)}
          </Text>
        </View>
        <Radio selected={selected} />
      </Pressable>
      {selected ? <AdapterFields choice={choice} /> : null}
    </View>
  );
};

export default AdapterOption;
