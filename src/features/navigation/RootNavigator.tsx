import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import ConnectionLostOverlay from '@/features/connect/ConnectionLostOverlay';

import { useConnectionFlow } from './useConnectionFlow';
import { useNavigationTheme, useSheetOptions, useStackScreenOptions } from './useNavigationOptions';

const RootNavigator = () => {
  const { t } = useTranslation();
  const navigationTheme = useNavigationTheme();
  const screenOptions = useStackScreenOptions();
  const sheetOptions = useSheetOptions();

  useConnectionFlow();

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings/index"
          options={{ title: t('settings.title'), headerLargeTitle: true }}
        />
        <Stack.Screen
          name="settings/cable"
          options={{ title: t('cable.title'), headerLargeTitle: true }}
        />
        <Stack.Screen
          name="settings/language"
          options={{ title: t('settings.language'), headerLargeTitle: true }}
        />
        <Stack.Screen
          name="settings/ble-devices"
          options={{ title: t('connect.devices.title'), headerLargeTitle: true }}
        />
        <Stack.Screen
          name="settings/demo-chassis"
          options={{ title: t('settings.demoChassis'), headerLargeTitle: true }}
        />
        <Stack.Screen
          name="home"
          options={{ title: t('home.title'), headerLargeTitle: true, headerBackVisible: false }}
        />
        <Stack.Screen
          name="library"
          options={{ title: t('library.title'), headerLargeTitle: true }}
        />
        <Stack.Screen name="preset/[id]" options={{ title: t('preset.editTitle') }} />
        <Stack.Screen
          name="favourites/edit"
          options={{ title: t('favourites.editTitle'), headerLargeTitle: true }}
        />
        <Stack.Screen name="preset/add-step" options={sheetOptions} />
        <Stack.Screen name="icon-picker" options={sheetOptions} />
        <Stack.Screen name="tile-menu" options={sheetOptions} />
      </Stack>
      <ConnectionLostOverlay />
    </ThemeProvider>
  );
};

export default RootNavigator;
