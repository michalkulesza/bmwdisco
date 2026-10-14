import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { AdapterError } from '@/protocol/errors';
import { useSessionActions } from '@/session';
import { DEMO_CONFIG, makeDeps, renderWithSession } from '@/test-utils/session-ui';
import { errorHaptic, successHaptic } from '@/ui/haptics';

import { useConnectionFlow } from '../useConnectionFlow';

const mockRouter = {
  replace: jest.fn(),
  dismissAll: jest.fn(),
  canDismiss: jest.fn(() => true),
};
const mockPathname = { current: '/' };

jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  usePathname: () => mockPathname.current,
}));

jest.mock('@/ui/haptics', () => ({
  successHaptic: jest.fn(),
  errorHaptic: jest.fn(),
  selectionHaptic: jest.fn(),
}));

const Harness = () => {
  useConnectionFlow();
  const { connect, disconnect } = useSessionActions();

  const handleConnectPress = () => connect(DEMO_CONFIG);

  return (
    <>
      <Text>flow</Text>
      <Pressable accessibilityLabel="connect" onPress={handleConnectPress} />
      <Pressable accessibilityLabel="disconnect" onPress={disconnect} />
    </>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname.current = '/';
  mockRouter.canDismiss.mockReturnValue(true);
});

describe('useConnectionFlow', () => {
  it('leaves the redirect and haptic to the connect screen when ready on it', async () => {
    await renderWithSession(<Harness />);

    await fireEvent.press(screen.getByLabelText('connect'));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(successHaptic).not.toHaveBeenCalled();
  });

  it('does not navigate when the user is somewhere else', async () => {
    mockPathname.current = '/settings';
    await renderWithSession(<Harness />);

    await fireEvent.press(screen.getByLabelText('connect'));

    await waitFor(() => expect(successHaptic).toHaveBeenCalled());
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('returns to the connect screen after disconnecting', async () => {
    mockPathname.current = '/home';
    await renderWithSession(<Harness />);
    await fireEvent.press(screen.getByLabelText('connect'));
    await waitFor(() => expect(successHaptic).toHaveBeenCalled());

    await fireEvent.press(screen.getByLabelText('disconnect'));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(mockRouter.dismissAll).toHaveBeenCalled();
  });

  it('fires an error haptic when connecting fails', async () => {
    const deps = makeDeps({
      createLink: async () => {
        throw new AdapterError('connect-failed');
      },
    });
    await renderWithSession(<Harness />, deps);

    await fireEvent.press(screen.getByLabelText('connect'));

    await waitFor(() => expect(errorHaptic).toHaveBeenCalledTimes(1));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
