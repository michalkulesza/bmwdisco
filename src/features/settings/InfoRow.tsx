import { View } from 'react-native';

import Text from '@/ui/Text';

import type { ReactNode } from 'react';

interface InfoRowProps {
  label: string;
  value?: string;
  left?: ReactNode;
  right?: ReactNode;
}

const InfoRow = ({ label, value, left, right }: InfoRowProps) => (
  <View className="min-h-14 flex-row items-center gap-3 px-4">
    {left}
    <Text variant="bodyMedium" className="flex-1">
      {label}
    </Text>
    {value ? (
      <Text variant="meta" tone="soft">
        {value}
      </Text>
    ) : null}
    {right}
  </View>
);

export default InfoRow;
