import { act, fireEvent, screen } from '@testing-library/react-native';

import '@/i18n';
import { useFavouritesStore } from '@/stores/favourites';
import { SEED_PRESETS, usePresetsStore } from '@/stores/presets';
import { fakeCar, resetSession, sessionState } from '@/test-utils/mock-session';
import { renderScreen, reorderable, resetRouter, routerMock } from '@/test-utils/mock-ui';

import EditFavouritesScreen from '.';

jest.mock('@/session', () => jest.requireActual('@/test-utils/mock-session').sessionModule);
jest.mock('expo-router', () => jest.requireActual('@/test-utils/mock-ui').routerModule);
jest.mock(
  'react-native-reorderable-list',
  () => jest.requireActual('@/test-utils/mock-ui').reorderableModule,
);

const orderedIds = () => useFavouritesStore.getState().ids;

describe('EditFavouritesScreen', () => {
  beforeEach(() => {
    resetSession();
    resetRouter();
    sessionState.car = fakeCar();
    usePresetsStore.setState({ presets: [...SEED_PRESETS] });
    useFavouritesStore.setState({
      ids: ['seed-double-flash', 'toggle.hazard', 'flash.highBeam'],
      size: 'regular',
    });
  });

  it('lists the favourites with remove and drag handles', async () => {
    await renderScreen(<EditFavouritesScreen />);

    expect(
      screen.getByRole('button', { name: 'Remove Double flash from favourites' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reorder Hazard lights' })).toBeTruthy();
    expect(screen.getByText('Hold and drag to reorder.')).toBeTruthy();
  });

  it('removes a favourite', async () => {
    await renderScreen(<EditFavouritesScreen />);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Remove Hazard lights from favourites' }),
    );

    expect(orderedIds()).toEqual(['seed-double-flash', 'flash.highBeam']);
  });

  it('reorders favourites', async () => {
    await renderScreen(<EditFavouritesScreen />);

    await act(async () => reorderable.props!.onReorder({ from: 0, to: 2 }));

    expect(orderedIds()).toEqual(['toggle.hazard', 'flash.highBeam', 'seed-double-flash']);
  });

  it.each([
    ['Small', 'small'],
    ['Large', 'large'],
  ] as const)('changes the tile size to %s', async (label, size) => {
    await renderScreen(<EditFavouritesScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: label }));

    expect(useFavouritesStore.getState().size).toBe(size);
  });

  it('adds a favourite from the candidates', async () => {
    await renderScreen(<EditFavouritesScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add Fog strobe to favourites' }));

    expect(orderedIds()).toContain('seed-fog-strobe');
    expect(screen.queryByRole('button', { name: 'Add Fog strobe to favourites' })).toBeNull();
  });

  it('closes with Done', async () => {
    await renderScreen(<EditFavouritesScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });
});
