import { Pressable, View } from 'react-native';

import Text from './Text';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

const SectionHeader = ({ title, actionLabel, onActionPress }: SectionHeaderProps) => (
  <View className="min-h-7 flex-row items-center justify-between">
    <Text variant="section" accessibilityRole="header">
      {title}
    </Text>
    {actionLabel && onActionPress ? (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={actionLabel}
        onPress={onActionPress}
        className="-my-2 min-h-touch justify-center px-1 active:opacity-60"
      >
        <Text variant="label" tone="soft">
          {actionLabel}
        </Text>
      </Pressable>
    ) : null}
  </View>
);

export default SectionHeader;
