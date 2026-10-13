import { router } from 'expo-router';
import { Lightning, PlugsConnected, Sliders } from 'phosphor-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import Button from '@/ui/Button';
import Screen from '@/ui/Screen';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

import CableFooter from './CableFooter';
import { useConnect } from './useConnect';

const RING_RADII = [110, 170, 235] as const;
const RING_SIZE = 560;
const RING_CENTER = RING_SIZE / 2;

const Rings = () => {
  const stroke = useColorToken('card-border');

  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        {RING_RADII.map((radius) => (
          <Circle
            key={radius}
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={radius}
            stroke={stroke}
            strokeWidth={1.5}
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
};

const Brand = () => {
  const { t } = useTranslation();
  const accent = useColorToken('blue');

  return (
    <View className="items-center gap-7">
      <View className="size-[132px] items-center justify-center rounded-pill border border-line bg-card">
        <Lightning size={56} weight="fill" color={accent} />
      </View>
      <View className="items-center gap-3">
        <Text variant="title" accessibilityRole="header">
          {t('connect.appName')}
        </Text>
        <Text variant="meta" tone="muted" className="max-w-[270px] text-center">
          {t('connect.subtitle')}
        </Text>
      </View>
    </View>
  );
};

const NotConnectedView = () => {
  const { t } = useTranslation();
  const connect = useConnect();

  const handleSettingsPress = useCallback(() => router.push('/settings'), []);

  return (
    <Screen scroll={false} topInset>
      <Rings />
      <View className="flex-1 items-center justify-center">
        <Brand />
      </View>
      <View className="gap-3">
        <Button label={t('connect.connect')} icon={PlugsConnected} onPress={connect} />
        <Button
          label={t('connect.settings')}
          icon={Sliders}
          variant="secondary"
          onPress={handleSettingsPress}
        />
        <CableFooter />
      </View>
    </Screen>
  );
};

export default NotConnectedView;
