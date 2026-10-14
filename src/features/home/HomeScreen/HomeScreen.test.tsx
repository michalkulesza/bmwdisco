import { fireEvent, screen } from '@testing-library/react-native';

import '@/i18n';
import { useReportStore } from '@/features/report/store';
import { useFavouritesStore } from '@/stores/favourites';
import { SEED_PRESETS, usePresetsStore } from '@/stores/presets';
import { fakeCar, resetSession, sessionActions, sessionState } from '@/test-utils/mock-session';
import { renderScreen, resetRouter, routerMock } from '@/test-utils/mock-ui';

import HomeScreen from '.';

jest.mock('@/session', () => jest.requireActual('@/test-utils/mock-session').sessionModule);
jest.mock('expo-router', () => jest.requireActual('@/test-utils/mock-ui').routerModule);
jest.mock('@/ui/Toast', () => jest.requireActual('@/test-utils/mock-ui').toastModule);

jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const Actual = jest.requireActual('react-native/Libraries/Lists/FlatList').default;
  const WideFlatList = (props: object) => <Actual initialNumToRender={50} {...props} />;

  return { __esModule: true, default: WideFlatList };
});

const showEmptyFavourites = () => useFavouritesStore.setState({ ids: [] });

describe('HomeScreen', () => {
  beforeEach(() => {
    resetSession();
    resetRouter();
    sessionState.car = fakeCar();
    usePresetsStore.setState({ presets: [...SEED_PRESETS] });
    useFavouritesStore.setState({ ids: ['toggle.hazard'], size: 'regular' });
  });

  it('renders the favourites, predefined and presets sections', async () => {
    await renderScreen(<HomeScreen />);

    expect(screen.getByText('Favourites')).toBeTruthy();
    expect(screen.getByText('Predefined')).toBeTruthy();
    expect(screen.getByText('My presets')).toBeTruthy();
    expect(screen.getAllByRole('switch', { name: 'Hazard lights, Off' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /^Flash high beams/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Fog strobe/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New preset' })).toBeTruthy();
  });

  it('shows only predefined lights available on the car', async () => {
    sessionState.car = fakeCar(['flash.highBeam']);
    showEmptyFavourites();
    await renderScreen(<HomeScreen />);

    expect(screen.getByRole('button', { name: /^Flash high beams/ })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /^Hazard lights/ })).toBeNull();
  });

  it('runs a preset on tap', async () => {
    showEmptyFavourites();
    await renderScreen(<HomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /^Fog strobe/ }));

    expect(sessionActions.run).toHaveBeenCalledWith(SEED_PRESETS[1]);
  });

  it('stops a running tile on tap', async () => {
    sessionState.tiles['seed-fog-strobe'] = { state: 'running' };
    showEmptyFavourites();
    await renderScreen(<HomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Stop Fog strobe' }));

    expect(sessionActions.stop).toHaveBeenCalledTimes(1);
  });

  it('toggles an effect with its on and off state', async () => {
    await renderScreen(<HomeScreen />);

    await fireEvent.press(screen.getAllByRole('switch', { name: 'Hazard lights, Off' })[0]!);

    expect(sessionActions.toggle).toHaveBeenCalledWith('toggle.hazard', true);
  });

  it('shows the favourites empty state', async () => {
    showEmptyFavourites();
    await renderScreen(<HomeScreen />);

    expect(screen.getByText('No favourites yet')).toBeTruthy();
  });

  it('shows the presets empty state and creates a preset from it', async () => {
    usePresetsStore.setState({ presets: [] });
    await renderScreen(<HomeScreen />);

    expect(screen.getByText('Build your own light show')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Create preset' }));

    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/preset/[id]',
      params: { id: 'new' },
    });
  });

  it('shows the not connected notice and disables tiles', async () => {
    sessionState.car = undefined;
    await renderScreen(<HomeScreen />);

    expect(screen.getByText('Not connected. Connect to your car to run lights.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Connect' }));
    expect(routerMock.navigate).toHaveBeenCalledWith('/');

    const tile = screen.getByRole('button', { name: /^Flash high beams/ });
    await fireEvent.press(tile);
    expect(sessionActions.run).not.toHaveBeenCalled();
  });

  it('navigates from the section actions and the settings button', async () => {
    await renderScreen(<HomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    await fireEvent.press(screen.getByRole('button', { name: 'See all' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));

    expect(routerMock.push).toHaveBeenCalledWith('/favourites/edit');
    expect(routerMock.push).toHaveBeenCalledWith('/library');
    expect(routerMock.push).toHaveBeenCalledWith('/settings');
  });

  it('opens the tile menu from the options button', async () => {
    await renderScreen(<HomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'More options for Fog strobe' }));

    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/tile-menu',
      params: { id: 'seed-fog-strobe' },
    });
  });

  it.each(['small', 'large'] as const)('lays favourites out in the %s size', async (size) => {
    useFavouritesStore.setState({ size });
    await renderScreen(<HomeScreen />);

    expect(screen.getAllByRole('switch', { name: 'Hazard lights, Off' })).toHaveLength(2);
  });

  it('opens the problem report from the header bug button', async () => {
    useReportStore.setState({ open: false });
    await renderScreen(<HomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Report a problem' }));

    expect(useReportStore.getState().open).toBe(true);
  });
});
