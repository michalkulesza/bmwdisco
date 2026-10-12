import { Stack } from 'expo-router/stack';
import { StatusBar } from 'react-native';
import BlePickerHost from '../src/BlePickerHost';
import { VehicleProvider } from '../src/vehicle-context';

export default function RootLayout() {
  return <VehicleProvider>
    <StatusBar barStyle="light-content" />
    <Stack screenOptions={{
      headerStyle: { backgroundColor: '#0B1322' },
      headerTintColor: '#F2F6FF',
      headerShadowVisible: false,
      contentStyle: { backgroundColor: '#080F1C' },
    }}>
      <Stack.Screen name="index" options={{ title: 'BimmerDisco', headerLargeTitle: true, headerLargeStyle: { backgroundColor: '#0B1322' } }} />
      <Stack.Screen name="presets" options={{ title: 'Lighting presets' }} />
    </Stack>
    <BlePickerHost />
  </VehicleProvider>;
}
