import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ReactNode } from 'react';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  topInset?: boolean;
  keyboardAware?: boolean;
}

const Screen = ({
  children,
  scroll = true,
  topInset = false,
  keyboardAware = false,
}: ScreenProps) => {
  const insets = useSafeAreaInsets();
  const insetStyle = { paddingTop: topInset ? insets.top : 0, paddingBottom: insets.bottom };

  if (!scroll) {
    return (
      <View className="flex-1 gap-8 bg-page px-4" style={insetStyle}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-page"
      contentContainerClassName="gap-8 px-4"
      contentContainerStyle={insetStyle}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={keyboardAware}
    >
      {children}
    </ScrollView>
  );
};

export default Screen;
