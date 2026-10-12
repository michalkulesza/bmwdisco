import { Stack } from 'expo-router/stack';
import { StatusBar } from 'react-native';

export default function RootLayout() {
  return <>
    <StatusBar barStyle="light-content" />
    <Stack screenOptions={{
      headerStyle: { backgroundColor: '#0B1322' },
      headerTintColor: '#F2F6FF',
      headerShadowVisible: false,
      contentStyle: { backgroundColor: '#080F1C' },
    }}>
      <Stack.Screen name="index" options={{ title: 'Bimlight', headerLargeTitle: true, headerLargeStyle: { backgroundColor: '#0B1322' } }} />
    </Stack>
  </>;
}
