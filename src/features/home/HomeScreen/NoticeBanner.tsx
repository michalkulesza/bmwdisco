import { WifiSlashIcon } from 'phosphor-react-native/src/icons/WifiSlash';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import Button from '@/ui/Button';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

interface NoticeBannerProps {
  onConnect: () => void;
}

const NoticeBanner = ({ onConnect }: NoticeBannerProps) => {
  const { t } = useTranslation();
  const color = useColorToken('text-muted');

  return (
    <View className="mt-4 flex-row items-center gap-3 rounded-card border border-card-border bg-card p-3">
      <WifiSlashIcon size={22} color={color} />
      <Text variant="meta" tone="muted" className="flex-1">
        {t('home.notConnected')}
      </Text>
      <Button label={t('home.connect')} onPress={onConnect} variant="pill" />
    </View>
  );
};

export default NoticeBanner;
