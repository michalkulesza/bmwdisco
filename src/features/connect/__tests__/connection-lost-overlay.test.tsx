import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Pressable, Text } from 'react-native';

import { SimLink } from '@/link/sim-link';
import { useSessionActions, useSessionPhase } from '@/session';
import { SimulatedVehicle } from '@/simulator/simulated-vehicle';
import { DEMO_CONFIG, makeDeps, renderWithSession } from '@/test-utils/session-ui';

import ConnectionLostOverlay from '../ConnectionLostOverlay';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const Harness = () => {
  const phase = useSessionPhase();
  const { connect } = useSessionActions();

  const handleConnectPress = () => connect(DEMO_CONFIG);

  return (
    <>
      <Text>{`phase:${phase}`}</Text>
      <Pressable accessibilityLabel="connect" onPress={handleConnectPress} />
      <ConnectionLostOverlay />
    </>
  );
};

const connectedHarness = async (vehicle: SimulatedVehicle, debug = false) => {
  const deps = makeDeps({
    debug,
    createLink: async () => new SimLink(vehicle),
    reconnectBaseDelayMs: 60_000,
  });
  await renderWithSession(<Harness />, deps);
  await fireEvent.press(screen.getByLabelText('connect'));
  await waitFor(() => expect(screen.getByText('phase:ready')).toBeTruthy());
};

describe('ConnectionLostOverlay', () => {
  it('stays hidden while the session is healthy', async () => {
    await connectedHarness(new SimulatedVehicle({ profile: 'F32', seed: 1 }));

    expect(screen.queryByText('Reconnect & restore')).toBeNull();
  });

  it('copies diagnostics while the connection-loss modal is open', async () => {
    const vehicle = new SimulatedVehicle({ profile: 'F32', seed: 1 });
    await connectedHarness(vehicle, true);
    vehicle.faults.configure({ dropAtMs: 1 });
    await waitFor(() => expect(screen.getByText('phase:reconnecting')).toBeTruthy(), {
      timeout: 5000,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Copy diagnostic log' }));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('Phase: reconnecting'),
    );
  });

  it('reconnects immediately from the overlay without restarting the app', async () => {
    const vehicle = new SimulatedVehicle({ profile: 'F32', seed: 1 });
    await connectedHarness(vehicle);
    vehicle.faults.configure({ dropAtMs: 1 });
    await waitFor(() => expect(screen.getByText('phase:reconnecting')).toBeTruthy(), {
      timeout: 5000,
    });
    vehicle.faults.configure({ dropAtMs: undefined });
    await fireEvent.press(screen.getByRole('button', { name: 'Reconnect & restore' }));
    await waitFor(() => expect(screen.getByText('phase:ready')).toBeTruthy());
    expect(screen.queryByText('Reconnect & restore')).toBeNull();
  });

  it('shows the attempt counter and lets the user disconnect while reconnecting', async () => {
    const vehicle = new SimulatedVehicle({ profile: 'F32', seed: 1 });
    await connectedHarness(vehicle);

    vehicle.faults.configure({ dropAtMs: 1 });

    await waitFor(() => expect(screen.getByText('phase:reconnecting')).toBeTruthy(), {
      timeout: 5000,
    });
    expect(screen.getByText('Reconnect & restore')).toBeTruthy();
    expect(screen.getByText('Reconnecting…')).toBeTruthy();
    expect(screen.getByText('Attempt 1 of 3')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(screen.queryByText('Reconnect & restore')).toBeNull());
  });
});
