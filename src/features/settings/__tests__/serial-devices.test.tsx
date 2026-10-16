import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/i18n';
import { useSettingsStore } from '@/stores/settings';

import SerialDevicesScreen from '../SerialDevicesScreen';

const mockList = jest.fn();
const mockBack = jest.fn();
let mockKind = 'bluetooth';

jest.mock('expo-router', () => ({
  router: { back: () => mockBack() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ kind: mockKind }),
}));
jest.mock('@/transport/AndroidSerialTransport', () => ({
  listAndroidSerialDevices: (...args: unknown[]) => mockList(...args),
}));
jest.mock('@/ui/haptics', () => ({ selectionHaptic: jest.fn() }));

const renderPicker = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <SerialDevicesScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  mockKind = 'bluetooth';
  mockList.mockReset();
  mockBack.mockReset();
  useSettingsStore.setState({ language: 'en', elmBluetoothDevice: null, usbDevice: null });
});
afterEach(() => jest.restoreAllMocks());

it('lists paired Classic devices and persists the selection separately from BLE', async () => {
  mockList.mockResolvedValue([{ id: 'AA:BB', name: 'ELM327' }]);
  await renderPicker();
  await fireEvent.press(await screen.findByRole('radio', { name: 'ELM327' }));
  expect(mockList).toHaveBeenCalledWith('bluetooth');
  expect(useSettingsStore.getState().elmBluetoothDevice?.id).toBe('AA:BB');
  expect(mockBack).toHaveBeenCalled();
});

it('lists attached USB devices and persists the USB selection', async () => {
  mockKind = 'usb';
  mockList.mockResolvedValue([{ id: '42', name: 'FTDI' }]);
  await renderPicker();
  await fireEvent.press(await screen.findByRole('radio', { name: 'FTDI' }));
  expect(mockList).toHaveBeenCalledWith('usb');
  expect(useSettingsStore.getState().usbDevice?.id).toBe('42');
  expect(useSettingsStore.getState().elmBluetoothDevice).toBeNull();
});

it('shows failures and retries enumeration', async () => {
  mockList.mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce([]);
  await renderPicker();
  expect(await screen.findByText(/Could not list adapters/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(/No adapters found/)).toBeTruthy();
  expect(mockList).toHaveBeenCalledTimes(2);
});

it('does not call Android native APIs on iOS', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  await renderPicker();
  expect(mockList).not.toHaveBeenCalled();
});
