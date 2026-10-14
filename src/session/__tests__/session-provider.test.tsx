import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { createLink, type SessionDeps } from '@/domain';
import { useSettingsStore } from '@/stores/settings';

import { SessionProvider, useSessionActions, useSessionPhase } from '..';

const demoDeps: SessionDeps = {
  createLink: (config, signal) =>
    createLink(config, { createTcpTransport: jest.fn(), createBleTransport: jest.fn() }, signal),
  appState: { subscribe: () => () => undefined },
};

const DEMO_CONFIG = { adapter: 'demo', chassis: 'F32', seed: 1 } as const;

const Probe = () => {
  const phase = useSessionPhase();
  const { connect } = useSessionActions();

  const handleConnectOnPress = () => connect(DEMO_CONFIG);

  return (
    <Pressable accessibilityRole="button" onPress={handleConnectOnPress}>
      <Text>{phase}</Text>
    </Pressable>
  );
};

const hostedDeps = (host: string): SessionDeps => ({
  appState: demoDeps.appState,
  createLink: async (config, signal) => {
    const link = await demoDeps.createLink(DEMO_CONFIG, signal);
    Object.defineProperty(link, 'host', { value: host });

    return link;
  },
});

const EnetProbe = () => {
  const { connect } = useSessionActions();

  const handleConnectOnPress = () => connect({ adapter: 'enet' });

  return (
    <Pressable accessibilityRole="button" onPress={handleConnectOnPress}>
      <Text>enet</Text>
    </Pressable>
  );
};

describe('SessionProvider', () => {
  beforeEach(() => useSettingsStore.setState({ lastEnetHost: '' }));

  it('records the resolved ENET host once the session is ready', async () => {
    await render(
      <SessionProvider deps={hostedDeps('169.254.7.7')}>
        <EnetProbe />
      </SessionProvider>,
    );

    await fireEvent.press(screen.getByRole('button'));

    await waitFor(() => expect(useSettingsStore.getState().lastEnetHost).toBe('169.254.7.7'), {
      timeout: 10000,
    });
  });

  it('does not record a host for other adapters', async () => {
    await render(
      <SessionProvider deps={hostedDeps('169.254.7.7')}>
        <Probe />
      </SessionProvider>,
    );

    await fireEvent.press(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy(), { timeout: 10000 });

    expect(useSettingsStore.getState().lastEnetHost).toBe('');
  });

  it('connects to the demo car and reaches ready', async () => {
    await render(
      <SessionProvider deps={demoDeps}>
        <Probe />
      </SessionProvider>,
    );

    expect(screen.getByText('idle')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy(), { timeout: 10000 });
  });
});
