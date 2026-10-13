import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { createLink, type SessionDeps } from '@/domain';

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

describe('SessionProvider', () => {
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
