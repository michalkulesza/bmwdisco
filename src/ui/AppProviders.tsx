import { useLayoutEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useSettingsStore } from '@/stores/settings';

import { applyThemeMode } from './theme';
import { ToastProvider } from './Toast';

const ROOT_STYLE = { flex: 1 };

const AppProviders = ({ children }: { children: ReactNode }) => {
  const theme = useSettingsStore((state) => state.theme);

  useLayoutEffect(() => {
    applyThemeMode(theme);
  }, [theme]);

  return (
    <GestureHandlerRootView style={ROOT_STYLE}>
      <View className="flex-1 bg-page">
        <ToastProvider>{children}</ToastProvider>
      </View>
    </GestureHandlerRootView>
  );
};

export default AppProviders;
