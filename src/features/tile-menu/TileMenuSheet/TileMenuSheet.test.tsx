import { fireEvent, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import '@/i18n';
import { sharePresets } from '@/features/preset/transfer';
import { useFavouritesStore } from '@/stores/favourites';
import { SEED_PRESETS, usePresetsStore } from '@/stores/presets';
import { fakeCar, resetSession, sessionState } from '@/test-utils/mock-session';
import {
  renderScreen,
  resetRouter,
  routerMock,
  searchParams,
  toastShow,
} from '@/test-utils/mock-ui';

import TileMenuSheet from '.';

jest.mock('@/session', () => jest.requireActual('@/test-utils/mock-session').sessionModule);
jest.mock('expo-router', () => jest.requireActual('@/test-utils/mock-ui').routerModule);
jest.mock('@/ui/Toast', () => jest.requireActual('@/test-utils/mock-ui').toastModule);
jest.mock('@/features/preset/transfer', () => ({
  sharePresets: jest.fn().mockResolvedValue(true),
  pickPresets: jest.fn(),
  exportFileName: (name: string) => `${name}.json`,
}));

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

const openMenu = async (id: string) => {
  searchParams.id = id;
  await renderScreen(<TileMenuSheet />);
};

describe('TileMenuSheet', () => {
  beforeEach(() => {
    resetSession();
    resetRouter();
    toastShow.mockClear();
    alertSpy.mockClear();
    sessionState.car = fakeCar();
    usePresetsStore.setState({ presets: [...SEED_PRESETS] });
    useFavouritesStore.setState({ ids: ['seed-double-flash'], size: 'regular' });
  });

  it('shows the header and every action for a preset', async () => {
    await openMenu('seed-fog-strobe');

    expect(screen.getByText('Fog strobe')).toBeTruthy();
    expect(screen.getByText('Steps: 6 · 0.4 s')).toBeTruthy();
    ['Add to favourites', 'Edit preset', 'Duplicate', 'Export preset', 'Delete'].forEach((label) =>
      expect(screen.getByRole('button', { name: label })).toBeTruthy(),
    );
  });

  it('offers only favourite and duplicate for a predefined light', async () => {
    await openMenu('toggle.hazard');

    expect(screen.getByRole('button', { name: 'Add to favourites' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit preset' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('adds to and removes from favourites', async () => {
    await openMenu('seed-fog-strobe');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to favourites' }));

    expect(useFavouritesStore.getState().ids).toContain('seed-fog-strobe');
    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  it('removes a favourite', async () => {
    await openMenu('seed-double-flash');
    await fireEvent.press(screen.getByRole('button', { name: 'Remove from favourites' }));

    expect(useFavouritesStore.getState().ids).toEqual([]);
  });

  it('opens the editor for a preset', async () => {
    await openMenu('seed-fog-strobe');
    await fireEvent.press(screen.getByRole('button', { name: 'Edit preset' }));

    expect(routerMock.replace).toHaveBeenCalledWith({
      pathname: '/preset/[id]',
      params: { id: 'seed-fog-strobe' },
    });
  });

  it('duplicates a preset', async () => {
    await openMenu('seed-fog-strobe');
    await fireEvent.press(screen.getByRole('button', { name: 'Duplicate' }));

    const presets = usePresetsStore.getState().presets;
    expect(presets).toHaveLength(SEED_PRESETS.length + 1);
    expect(presets.at(-1)).toMatchObject({
      name: 'Fog strobe copy',
      steps: SEED_PRESETS[1]!.steps,
    });
    expect(toastShow).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' }));
  });

  it('duplicates a predefined light into My presets', async () => {
    await openMenu('flash.highBeam');
    await fireEvent.press(screen.getByRole('button', { name: 'Duplicate' }));

    const copy = usePresetsStore.getState().presets.at(-1)!;
    expect(copy.name).toBe('Flash high beams');
    expect(copy.steps).toEqual([
      { type: 'set', elements: ['highBeamAll'], state: 'on', durationMs: 100 },
      { type: 'set', elements: ['highBeamAll'], state: 'off' },
    ]);
  });

  it('confirms before deleting and cleans up favourites', async () => {
    await openMenu('seed-double-flash');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(usePresetsStore.getState().presets).toHaveLength(SEED_PRESETS.length);

    const buttons = alertSpy.mock.calls[0]![2] as AlertButton[];
    buttons.find((button) => button.style === 'destructive')!.onPress!();

    expect(usePresetsStore.getState().presets.map((preset) => preset.id)).toEqual([
      'seed-fog-strobe',
    ]);
    expect(useFavouritesStore.getState().ids).toEqual([]);
    expect(routerMock.back).toHaveBeenCalled();
  });

  it('exports a preset through the share sheet', async () => {
    await openMenu('seed-fog-strobe');
    await fireEvent.press(screen.getByRole('button', { name: 'Export preset' }));

    expect(sharePresets).toHaveBeenCalledWith([SEED_PRESETS[1]], 'Fog strobe.json');
  });

  it('shows a message when the light no longer exists', async () => {
    await openMenu('missing');

    expect(screen.getByText('This light is no longer available.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(routerMock.back).toHaveBeenCalled();
  });
});
