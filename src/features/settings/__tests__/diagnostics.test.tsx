import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Alert, Pressable, Text } from 'react-native';

import { loadEffects } from '@/data/generated';
import type { SessionContext } from '@/domain';
import { useSessionActions, useSessionPhase } from '@/session';
import { DEMO_CONFIG, renderWithSession } from '@/test-utils/session-ui';

import { formatDiagnosticLog } from '../diagnostic-log';
import DiagnosticsSection from '../DiagnosticsSection';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
const copy = jest.mocked(Clipboard.setStringAsync);
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

const Harness = () => {
  const phase = useSessionPhase();
  const { connect, run } = useSessionActions();
  return (
    <>
      <Text>{`phase:${phase}`}</Text>
      <Pressable accessibilityLabel="connect" onPress={() => connect(DEMO_CONFIG)} />
      <Pressable
        accessibilityLabel="run indicator"
        onPress={() => run(loadEffects().find((effect) => effect.id === 'flash.indicatorLeft')!)}
      />
      <DiagnosticsSection />
    </>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  copy.mockResolvedValue(true);
});

it('exports metadata and timestamped entries while omitting the VIN and connection settings', () => {
  const vin = 'WBA1234567G123456';
  const context = {
    adapter: 'enet',
    diagnosticsEnabled: true,
    lightsMayBeOn: true,
    car: { chassis: 'F32', vin, modules: [{ sgbd: 'FEM_20' }] },
    config: { host: '169.254.1.1' },
    lastError: { reason: 'connectionLost' },
    log: [{ at: 0, message: `test ${vin}` }],
  } as unknown as SessionContext;
  const output = formatDiagnosticLog(context, 'reconnecting');
  expect(output).toContain('Modules: FEM_20');
  expect(output).toContain('Last error: connectionLost');
  expect(output).toContain('1970-01-01T00:00:00.000Z test [VIN omitted]');
  expect(output).not.toContain(vin);
  expect(output).not.toContain('169.254.1.1');
});

it('explains how to capture an empty log', async () => {
  await renderWithSession(<Harness />);
  await fireEvent.press(screen.getByRole('button', { name: 'Copy diagnostic log' }));
  expect(copy).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith('No diagnostic log yet', expect.any(String));
});

it('records a run, copies commands and replies, reports copy failures, and clears the log', async () => {
  await renderWithSession(<Harness />);
  await fireEvent.press(screen.getByRole('button', { name: 'Record diagnostic log' }));
  await fireEvent.press(screen.getByLabelText('connect'));
  await waitFor(() => expect(screen.getByText('phase:ready')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('run indicator'));
  await waitFor(() => expect(screen.getByText('phase:ready')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Copy diagnostic log' }));
  expect(copy).toHaveBeenCalledWith(expect.stringContaining('-> 40 2E D5 42 00 06 00 64'));
  expect(copy).toHaveBeenCalledWith(expect.stringContaining('<- 40 6E D5 42'));
  expect(alert).toHaveBeenCalledWith('Diagnostic log copied');
  copy.mockResolvedValueOnce(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Copy diagnostic log' }));
  expect(alert).toHaveBeenCalledWith('Could not copy the diagnostic log');
  await fireEvent.press(screen.getByRole('button', { name: 'Clear diagnostic log' }));
  copy.mockClear();
  await fireEvent.press(screen.getByRole('button', { name: 'Copy diagnostic log' }));
  expect(copy).not.toHaveBeenCalled();
});
