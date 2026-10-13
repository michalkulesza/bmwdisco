import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { TransportError } from '@/transport/errors';

import BleDevicesScreen from '../BleDevicesScreen';
import DemoChassisScreen from '../DemoChassisScreen';
import LanguageScreen from '../LanguageScreen';

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockScan = jest.fn();

jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));

jest.mock('@/ui/haptics', () => ({ selectionHaptic: jest.fn() }));

jest.mock('@/transport/ble-scan', () => ({
  scanBleAdapters: (...args: unknown[]) => mockScan(...args),
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderScreen = (ui: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ language: 'en', demoChassis: 'F32', icarDevice: null });
});

describe('LanguageScreen', () => {
  it('lists the languages and stores the choice', async () => {
    await renderScreen(<LanguageScreen />);

    expect(screen.getByRole('radio', { name: 'System' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Polski' }));

    expect(useSettingsStore.getState().language).toBe('pl');
    await act(async () => useSettingsStore.getState().setLanguage('en'));
  });
});

describe('DemoChassisScreen', () => {
  it('marks the current chassis and stores another one', async () => {
    await renderScreen(<DemoChassisScreen />);

    expect(screen.getByRole('radio', { name: /^F32/, checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: /^F33/ }));

    expect(useSettingsStore.getState().demoChassis).toBe('F33');
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('BleDevicesScreen', () => {
  it('lists scanned adapters and remembers the chosen device', async () => {
    mockScan.mockImplementation(async ({ onFound }) => {
      onFound({ id: 'AA:01', name: 'Vgate iCar', rssi: -50, serviceUuids: [] });
      onFound({ id: 'AA:02', name: null, rssi: -80, serviceUuids: [] });
    });
    await renderScreen(<BleDevicesScreen />);

    expect(await screen.findByText('Vgate iCar')).toBeTruthy();
    expect(screen.getByText('Unnamed adapter')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Vgate iCar' }));

    expect(useSettingsStore.getState().icarDevice).toEqual({ id: 'AA:01', name: 'Vgate iCar' });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('shows the Bluetooth error screen and rescans on retry', async () => {
    mockScan.mockRejectedValueOnce(new TransportError('bluetooth-off'));
    mockScan.mockResolvedValueOnce(undefined);
    await renderScreen(<BleDevicesScreen />);

    expect(await screen.findByText('Bluetooth is off')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByText('Searching for adapters…')).toBeTruthy());
    expect(mockScan).toHaveBeenCalledTimes(2);
  });

  it('shows the denied state', async () => {
    mockScan.mockRejectedValueOnce(new TransportError('bluetooth-denied'));
    await renderScreen(<BleDevicesScreen />);

    expect(await screen.findByText('Bluetooth access denied')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
