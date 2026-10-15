import { View } from 'react-native';

import Text from '@/ui/Text';

import type { ReactNode } from 'react';

interface CardShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

const CardShell = ({ title, description, children }: CardShellProps) => (
  <View className="gap-3 rounded-card border border-card-border bg-card p-4">
    <View className="gap-1">
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {description ? (
        <Text variant="meta" tone="muted">
          {description}
        </Text>
      ) : null}
    </View>
    {children}
  </View>
);

export default CardShell;
