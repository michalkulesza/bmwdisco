import { fireEvent, screen } from '@testing-library/react-native';

import '@/i18n';
import { fakeCar, resetSession, sessionActions, sessionState } from '@/test-utils/mock-session';
import { renderScreen, resetRouter, routerMock } from '@/test-utils/mock-ui';

import LibraryScreen from '.';

jest.mock('@/session', () => jest.requireActual('@/test-utils/mock-session').sessionModule);
jest.mock('expo-router', () => jest.requireActual('@/test-utils/mock-ui').routerModule);

describe('LibraryScreen', () => {
  beforeEach(() => {
    resetSession();
    resetRouter();
    sessionState.car = fakeCar();
  });

  it('groups lights into pack sections', async () => {
    await renderScreen(<LibraryScreen />);

    expect(screen.getByText('Headlight shows')).toBeTruthy();
  });

  it('filters by the translated name, ignoring case and diacritics', async () => {
    await renderScreen(<LibraryScreen />);

    await fireEvent.changeText(screen.getByLabelText('Search lights'), 'HAZARD');

    expect(screen.getByRole('switch', { name: /^Hazard lights/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Flash high beams/ })).toBeNull();
  });

  it('shows an empty state when nothing matches', async () => {
    await renderScreen(<LibraryScreen />);

    await fireEvent.changeText(screen.getByLabelText('Search lights'), 'zzzzzz');

    expect(screen.getByText('No lights found')).toBeTruthy();
  });

  it('dims lights that are not on the car and shows a note', async () => {
    sessionState.car = fakeCar(['flash.highBeam']);
    await renderScreen(<LibraryScreen />);
    await fireEvent.changeText(screen.getByLabelText('Search lights'), 'front fog lights');

    const dimmed = screen.getByRole('button', { name: /^Flash front fog lights, Not on your car/ });
    await fireEvent.press(dimmed);

    expect(dimmed.props.accessibilityState).toMatchObject({ disabled: true });
    expect(sessionActions.run).not.toHaveBeenCalled();
    expect(screen.getByText(/Lights marked/)).toBeTruthy();
  });

  it('shows On and Off for toggle lights', async () => {
    sessionState.activeToggles = ['toggle.hazard'];
    await renderScreen(<LibraryScreen />);

    await fireEvent.changeText(screen.getByLabelText('Search lights'), 'hazard');

    expect(screen.getByRole('switch', { name: 'Hazard lights, On' })).toBeTruthy();
  });

  it('runs a light and opens its menu', async () => {
    await renderScreen(<LibraryScreen />);
    await fireEvent.changeText(screen.getByLabelText('Search lights'), 'high beams');

    await fireEvent.press(screen.getByRole('button', { name: /^Flash high beams/ }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'More options for Flash high beams' }),
    );

    expect(sessionActions.run).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'flash.highBeam' }),
    );
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/tile-menu',
      params: { id: 'flash.highBeam' },
    });
  });
});
