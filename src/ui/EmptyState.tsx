import { View } from 'react-native';

import Button from './Button';
import IconBadge from './IconBadge';
import Text from './Text';

import type { HueToken } from './theme';
import type { Icon } from 'phosphor-react-native';

interface EmptyStateProps {
  icon: Icon;
  title: string;
  description?: string;
  tone?: HueToken;
  actionLabel?: string;
  onActionPress?: () => void;
}

const EmptyState = ({
  icon,
  title,
  description,
  tone,
  actionLabel,
  onActionPress,
}: EmptyStateProps) => (
  <View className="flex-1 items-center justify-center gap-4 px-6 py-8">
    <IconBadge icon={icon} tone={tone} size="lg" />
    <View className="items-center gap-2">
      <Text variant="section" className="text-center" accessibilityRole="header">
        {title}
      </Text>
      {description ? (
        <Text variant="meta" tone="muted" className="text-center">
          {description}
        </Text>
      ) : null}
    </View>
    {actionLabel && onActionPress ? (
      <Button label={actionLabel} onPress={onActionPress} variant="secondary" />
    ) : null}
  </View>
);

export default EmptyState;
