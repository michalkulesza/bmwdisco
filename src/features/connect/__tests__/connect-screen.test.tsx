import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { AdapterError } from '@/protocol/errors';
import { useSettingsStore } from '@/stores/settings';
import { makeDeps, renderWithSession, unsupportedVehicleDeps } from '@/test-utils/session-ui';

import ConnectScreen from '../ConnectScreen';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));

jest.mock('@/ui/haptics', () => ({
  selectionHaptic: jest.fn(),
  successHaptic: jest.fn(),
  errorHaptic: jest.fn(),
}));

const failingLinkDeps = (error: Error) =>
  makeDeps({
    createLink: async () => {
      throw error;
    },
  });

const connectDemo = async () => {
  await fireEvent.press(screen.getByRole('button', { name: 'Connect' }));
};

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({
    adapter: 'demo',
    demoChassis: 'F32',
    enetHost: '',
    icarDevice: null,
    thorHost: '192.168.0.10',
    thorPort: '23',
  });
});

describe('ConnectScreen', () => {
  it('shows the idle state with the current cable and opens settings', async () => {
    await renderWithSession(<ConnectScreen />);

    expect(screen.getByText('BimmerDisco')).toBeTruthy();
    expect(screen.getByText('Demo')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/settings');
  });

  it('walks through the connecting steps for the demo car', async () => {
    await renderWithSession(<ConnectScreen />);

    await connectDemo();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy());
    expect(screen.getByText('Reaching adapter')).toBeTruthy();
    expect(screen.getByText('Identifying car')).toBeTruthy();
    expect(screen.getByText('Loading modules')).toBeTruthy();
  });

  it('cancels a connection attempt', async () => {
    await renderWithSession(<ConnectScreen />);
    await connectDemo();

    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy());
  });

  it('opens the cable screen when the configuration is incomplete', async () => {
    useSettingsStore.setState({ adapter: 'thor', thorPort: '0' });
    await renderWithSession(<ConnectScreen />);

    await connectDemo();

    expect(mockRouter.push).toHaveBeenCalledWith('/settings/cable');
  });

  it('opens the Bluetooth device list when no iCar is chosen', async () => {
    useSettingsStore.setState({ adapter: 'vgate' });
    await renderWithSession(<ConnectScreen />);

    await connectDemo();

    expect(mockRouter.push).toHaveBeenCalledWith('/settings/ble-devices');
  });

  it.each([
    ['bluetooth-off', 'Bluetooth is off'],
    ['bluetooth-denied', 'Bluetooth access denied'],
  ] as const)('shows the %s error with an Open Settings action', async (code, title) => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    useSettingsStore.setState({ adapter: 'demo' });
    await renderWithSession(<ConnectScreen />, failingLinkDeps(new AdapterError(code)));
    await connectDemo();

    expect(await screen.findByText(title)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));

    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('shows adapter unreachable and retries', async () => {
    let attempts = 0;
    const deps = makeDeps({
      createLink: async () => {
        attempts++;
        throw new AdapterError('connect-failed');
      },
    });
    await renderWithSession(<ConnectScreen />, deps);
    await connectDemo();

    expect(await screen.findByText('Adapter not reachable')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(attempts).toBe(2));
  });

  it('shows car not responding when every probe times out', async () => {
    useSettingsStore.setState({ adapter: 'demo' });
    const deps = makeDeps();
    const baseCreate = deps.createLink;
    deps.createLink = (config, signal) =>
      baseCreate(
        config.adapter === 'demo'
          ? { ...config, faults: { timeouts: { probability: 1 } } }
          : config,
        signal,
      );
    await renderWithSession(<ConnectScreen />, deps);
    await connectDemo();

    expect(await screen.findByText('Car not responding', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('shows the unsupported vehicle error and goes back to idle', async () => {
    await renderWithSession(<ConnectScreen />, unsupportedVehicleDeps());
    await connectDemo();

    expect(await screen.findByText('Car not supported', {}, { timeout: 5000 })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy());
  });

  it('keeps showing progress once the session is ready', async () => {
    await renderWithSession(<ConnectScreen />);
    await connectDemo();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
  });
});
