import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Pressable, Text } from 'react-native';

import { SimLink } from '@/link/sim-link';
import { NegativeResponseError } from '@/protocol/errors';
import { useSessionActions, useSessionPhase, useSessionSelector } from '@/session';
import { SimulatedVehicle } from '@/simulator/simulated-vehicle';
import { DEMO_CONFIG, makeDeps, renderWithSession } from '@/test-utils/session-ui';

import ConnectionLostOverlay from '../ConnectionLostOverlay';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const Harness = () => {
  const phase = useSessionPhase();
  const { connect, run } = useSessionActions();
  const indicator = useSessionSelector((snapshot) =>
    snapshot.context.car?.effects.find((effect) => effect.id === 'flash.indicatorLeft'),
  );
  const tile = useSessionSelector((snapshot) => snapshot.context.tiles['flash.indicatorLeft']);

  const handleConnectPress = () => connect(DEMO_CONFIG);
  const handleRunPress = () => indicator && run(indicator);

  return (
    <>
      <Text>{`phase:${phase}`}</Text>
      <Text>{`tile:${tile?.state ?? 'none'}`}</Text>
      <Pressable accessibilityLabel="run" onPress={handleRunPress} />
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

  it('never shows the overlay when the ECU refuses the command and the restore, and stays usable', async () => {
    const vehicle = new SimulatedVehicle({ profile: 'F32', seed: 1 });
    const deps = makeDeps({
      createLink: async () => {
        const link = new SimLink(vehicle);
        const request = link.request.bind(link);
        link.request = async (ecu, payload, options) => {
          if (payload[0] === 0x2e || payload[0] === 0x2f) {
            throw new NegativeResponseError(payload[0], 0x31);
          }

          return request(ecu, payload, options);
        };

        return link;
      },
      reconnectBaseDelayMs: 60_000,
    });
    await renderWithSession(<Harness />, deps);
    await fireEvent.press(screen.getByLabelText('connect'));
    await waitFor(() => expect(screen.getByText('phase:ready')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('run'));
    await waitFor(() => expect(screen.getByText('tile:error')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('phase:ready')).toBeTruthy());

    expect(screen.queryByText('Reconnect & restore')).toBeNull();
  });
});
