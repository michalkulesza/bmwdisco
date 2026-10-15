import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Alert, Pressable, Text } from 'react-native';

import { useSessionActions, useSessionPhase } from '@/session';
import { SimulatedVehicle } from '@/simulator/simulated-vehicle';
import { DEMO_CONFIG, makeDeps, renderWithSession } from '@/test-utils/session-ui';

import TestCommandsScreen from '../TestCommandsScreen';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@/ui/haptics', () => ({
  selectionHaptic: jest.fn(),
  successHaptic: jest.fn(),
  errorHaptic: jest.fn(),
}));

const copy = jest.mocked(Clipboard.setStringAsync);
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

const CAR_MODULES = ['FEM_20', 'LHM2_L', 'LHM2_R', 'KOMB25', 'REM_20'] as const;

const deps = () =>
  makeDeps(
    {},
    {
      createVehicle: () =>
        new SimulatedVehicle({ profile: { chassis: 'F32', modules: [...CAR_MODULES] } }),
    },
  );

const Harness = () => {
  const phase = useSessionPhase();
  const { connect, toggle } = useSessionActions();

  return (
    <>
      <Text>{`phase:${phase}`}</Text>
      <Pressable accessibilityLabel="connect" onPress={() => connect(DEMO_CONFIG)} />
      <Pressable accessibilityLabel="hold toggle" onPress={() => toggle('toggle.hazard', true)} />
      <TestCommandsScreen />
    </>
  );
};

const renderConnected = async () => {
  await renderWithSession(<Harness />, deps());
  await fireEvent.press(screen.getByLabelText('connect'));
  await waitFor(() => expect(screen.getByText('phase:ready')).toBeTruthy());
};

const confirmLastAlert = async () => {
  const buttons = alert.mock.calls.at(-1)![2]!;
  const confirm = buttons.find((button) => button.style === 'destructive')!;
  await act(async () => confirm.onPress?.());
};

beforeEach(() => {
  jest.clearAllMocks();
  copy.mockResolvedValue(true);
});

describe('TestCommandsScreen', () => {
  it('asks to connect first when the session is not ready', async () => {
    await renderWithSession(<TestCommandsScreen />, deps());

    expect(screen.getByText('Connect to the car first')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Run Identity' })).toBeNull();
  });

  it('appends request, response and decoded result lines when a group runs', async () => {
    await renderConnected();

    await fireEvent.press(screen.getByRole('button', { name: 'Run Identity' }));

    await waitFor(() => expect(screen.getByLabelText(/Finished: Identity/)).toBeTruthy());
    expect(screen.getByLabelText(/FEM_20 0x40 > 22 F1 50 < 62 F1 50 .* = positive/)).toBeTruthy();
    expect(screen.getByLabelText(/REM_20 0x72 > 22 F1 50/)).toBeTruthy();
    expect(screen.getByLabelText(/FEM_20 0x40 > 22 D5 42/)).toBeTruthy();
  });

  it('copies the results and clears the log', async () => {
    await renderConnected();
    await fireEvent.press(screen.getByRole('button', { name: 'Run Identity' }));
    await waitFor(() => expect(screen.getByLabelText(/Finished: Identity/)).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Copy results' }));
    await waitFor(() => expect(copy).toHaveBeenCalled());
    expect(copy.mock.calls[0]![0]).toContain('BimmerDisco test results');
    expect(copy.mock.calls[0]![0]).toContain('FEM_20 0x40 > 22 F1 50');
    expect(alert).toHaveBeenCalledWith('Results copied');

    await fireEvent.press(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Nothing yet. Run a test.')).toBeTruthy();
  });

  it('confirms the guarded LHM2 write, then writes and restores the baseline', async () => {
    await renderConnected();
    await fireEvent.press(screen.getByRole('radio', { name: '300' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Run write' }));

    expect(alert).toHaveBeenCalledWith(
      'Write to the headlight module?',
      expect.stringContaining('may stay lit until the ignition is cycled'),
      expect.any(Array),
    );
    expect(screen.queryByLabelText(/28 02 01/)).toBeNull();

    await confirmLastAlert();

    await waitFor(() =>
      expect(screen.getByLabelText(/Finished: LHM2 single-channel write/)).toBeTruthy(),
    );
    expect(screen.getByLabelText(/LHM2_L 0x43 > 28 02 01/)).toBeTruthy();
    expect(screen.getByLabelText(/LHM2_L 0x43 \[cleanup\] > 28 00 03/)).toBeTruthy();
    expect(screen.getByLabelText(/LHM2_L 0x43 \[cleanup\] > 10 01/)).toBeTruthy();
  });

  it('validates the raw command and sends safe services without a confirmation', async () => {
    await renderConnected();

    await fireEvent.changeText(screen.getByLabelText('ECU address (hex)'), '40');
    await fireEvent.changeText(screen.getByLabelText('Payload (hex)'), '22 F');
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Use whole hex bytes, for example 22 F1 50.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Payload (hex)'), '22 F1 50');
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByLabelText(/FEM_20 0x40 > 22 F1 50/)).toBeTruthy());
    expect(alert).not.toHaveBeenCalled();
  });

  it('asks before sending other services and surfaces the NRC', async () => {
    await renderConnected();
    await fireEvent.changeText(screen.getByLabelText('ECU address (hex)'), '40');
    await fireEvent.changeText(screen.getByLabelText('Payload (hex)'), '2E 12 34 00');

    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(alert).toHaveBeenCalledWith(
      'Send this command?',
      expect.stringContaining('2E 12 34 00'),
      expect.any(Array),
    );
    await confirmLastAlert();

    await waitFor(() => expect(screen.getByLabelText(/NRC 0x/)).toBeTruthy());
    expect(screen.getByText(/Presets and effects stay locked/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Cleanup all' }));
    await waitFor(() => expect(screen.queryByText(/Presets and effects stay locked/)).toBeNull());
  });

  it('reads LHM2 records, saves labelled snapshots and shows the comparison', async () => {
    await renderConnected();

    await fireEvent.press(screen.getByRole('button', { name: 'Run Read now' }));
    await waitFor(() => expect(screen.getByLabelText(/Finished: Read now/)).toBeTruthy());
    await waitFor(() => expect(screen.getAllByText(/PWM\s+00 00/).length).toBe(2));
    await fireEvent.press(screen.getByRole('radio', { name: 'Lights off' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save snapshot' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Stalk left' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save snapshot' }));

    expect(screen.getByText('Snapshot comparison')).toBeTruthy();
    expect(screen.getAllByText('Lights off').length).toBeGreaterThan(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Copy results' }));
    await waitFor(() => expect(copy).toHaveBeenCalled());
    expect(copy.mock.calls[0]![0]).toContain('LHM2 snapshots');
    expect(copy.mock.calls[0]![0]).toContain('Lights off 0x43 PWM 0 0 0 0 0 0 0');

    await fireEvent.press(screen.getByRole('button', { name: 'Clear snapshots' }));
    expect(screen.queryByText('Snapshot comparison')).toBeNull();
  });

  it('explains why tests cannot start while a toggle is held', async () => {
    await renderConnected();

    await fireEvent.press(screen.getByLabelText('hold toggle'));
    await waitFor(() => expect(screen.getByText(/held toggle such as Hazard/)).toBeTruthy());

    const run = screen.getByRole('button', { name: 'Run Identity' });
    expect(run.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
