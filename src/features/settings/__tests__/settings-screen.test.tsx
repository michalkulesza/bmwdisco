import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, Pressable, Text } from 'react-native';

import { useSessionActions, useSessionPhase } from '@/session';
import { useSettingsStore } from '@/stores/settings';
import { DEMO_CONFIG, renderWithSession } from '@/test-utils/session-ui';

import SettingsScreen from '../SettingsScreen';

const mockRouter = { push: jest.fn(), back: jest.fn() };

jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));

jest.mock('@/ui/haptics', () => ({ selectionHaptic: jest.fn() }));

const Harness = () => {
  const phase = useSessionPhase();
  const { connect } = useSessionActions();

  const handleConnectPress = () => connect(DEMO_CONFIG);

  return (
    <>
      <Text>{`phase:${phase}`}</Text>
      <Pressable accessibilityLabel="connect" onPress={handleConnectPress} />
      <SettingsScreen />
    </>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ adapter: 'enet', theme: 'system', language: 'en' });
});

describe('SettingsScreen', () => {
  it('shows the cable row, theme and language when not connected', async () => {
    await renderWithSession(<Harness />);

    expect(screen.getByText('ENET')).toBeTruthy();
    expect(screen.queryByText('Disconnect')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Adapter' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/cable');

    await fireEvent.press(screen.getByRole('button', { name: 'App language' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/language');
  });

  it('changes the theme', async () => {
    await renderWithSession(<Harness />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));

    expect(useSettingsStore.getState().theme).toBe('dark');
  });

  it('shows status, adapter, latency and the detected car when connected', async () => {
    await renderWithSession(<Harness />);
    await fireEvent.press(screen.getByLabelText('connect'));

    expect(await screen.findByText('Connected')).toBeTruthy();
    expect(screen.getByText('Demo · Simulated')).toBeTruthy();
    expect(screen.getByText('Latency')).toBeTruthy();
    expect(screen.getByText(/^F\d{2} · /)).toBeTruthy();
    expect(screen.getByText(/^VIN •+/)).toBeTruthy();
    expect(screen.getByText('FEM_20')).toBeTruthy();
    expect(screen.getByText('Front electronics module')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Adapter' })).toBeNull();
  });

  it('asks for confirmation before disconnecting', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithSession(<Harness />);
    await fireEvent.press(screen.getByLabelText('connect'));
    await screen.findByText('Connected');

    await fireEvent.press(screen.getByRole('button', { name: 'Disconnect' }));

    expect(alert).toHaveBeenCalledTimes(1);
    expect(screen.getByText('phase:ready')).toBeTruthy();

    const buttons = alert.mock.calls[0]![2]!;
    const confirm = buttons.find((button) => button.style === 'destructive')!;
    await fireEvent.press(screen.getByRole('button', { name: 'Disconnect' }));
    confirm.onPress?.();

    await waitFor(() => expect(screen.getByText('phase:disconnected')).toBeTruthy());
  });
});
