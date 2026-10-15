import { Info, WarningCircle } from 'phosphor-react-native';
import { View } from 'react-native';

import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

interface StatusBannerProps {
  message: string;
  tone: 'info' | 'warning';
}

const StatusBanner = ({ message, tone }: StatusBannerProps) => {
  const iconColor = useColorToken(tone === 'warning' ? 'amber' : 'blue');
  const IconComponent = tone === 'warning' ? WarningCircle : Info;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={message}
      className="flex-row items-start gap-3 rounded-card border border-card-border bg-card p-4"
    >
      <IconComponent size={22} color={iconColor} />
      <Text variant="meta" tone="soft" className="flex-1">
        {message}
      </Text>
    </View>
  );
};

export default StatusBanner;
