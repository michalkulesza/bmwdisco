import { fireEvent, render, screen } from '@testing-library/react-native';
import { t } from 'i18next';

import '@/i18n';
import { loadEffects } from '@/data/generated';
import { usePresetsStore } from '@/stores/presets';
import { fakeCar, resetSession, sessionActions, sessionState } from '@/test-utils/mock-session';

import { effectItem, presetItem } from './items';
import Tile from './Tile';

import type { TileItem } from './types';

jest.mock('@/session', () => jest.requireActual('@/test-utils/mock-session').sessionModule);

const effect = (id: string) => loadEffects().find((candidate) => candidate.id === id)!;
const preset = usePresetsStore.getState().presets[0]!;

const renderTile = async (item: TileItem, size: 'small' | 'square' | 'large' = 'square') => {
  const onMenuPress = jest.fn();
  await render(<Tile item={item} size={size} onMenuPress={onMenuPress} />);

  return onMenuPress;
};

describe('Tile', () => {
  beforeEach(() => {
    resetSession();
    sessionState.car = fakeCar();
  });

  it('runs a preset on press and shows its summary', async () => {
    const item = presetItem(preset, t, true);
    await renderTile(item);

    await fireEvent.press(screen.getByRole('button', { name: /Double flash, Steps: 4/ }));

    expect(sessionActions.run).toHaveBeenCalledWith(preset);
  });

  it('shows Stop while running and stops on press', async () => {
    sessionState.tiles[preset.id] = { state: 'running' };
    await renderTile(presetItem(preset, t, true));

    await fireEvent.press(screen.getByRole('button', { name: 'Stop Double flash' }));

    expect(sessionActions.stop).toHaveBeenCalledTimes(1);
    expect(sessionActions.run).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'More options for Double flash' })).toBeNull();
  });

  it('shows the finished state after a run', async () => {
    sessionState.tiles[preset.id] = { state: 'justRan' };
    await renderTile(presetItem(preset, t, true));

    expect(screen.getByRole('button', { name: 'Double flash, Done' })).toBeTruthy();
  });

  it('shows the translated reason on error', async () => {
    sessionState.tiles[preset.id] = { state: 'error', reason: 'conditionsNotCorrect' };
    await renderTile(presetItem(preset, t, true));

    expect(screen.getByText('Stop the car or turn the ignition on')).toBeTruthy();
  });

  it('is disabled when the light is not on the car', async () => {
    sessionState.car = fakeCar(['flash.highBeam']);
    await renderTile(effectItem(effect('flash.fogFront'), t, sessionState.car));

    const tile = screen.getByRole('button', { name: /Not on your car/ });
    await fireEvent.press(tile);

    expect(tile.props.accessibilityState).toMatchObject({ disabled: true });
    expect(sessionActions.run).not.toHaveBeenCalled();
  });

  it('is disabled when not connected', async () => {
    await renderTile(effectItem(effect('flash.highBeam'), t, undefined));

    expect(screen.getByRole('button', { name: /Not connected/ })).toBeTruthy();
  });

  it('toggles a switch effect on and off', async () => {
    const item = effectItem(effect('toggle.hazard'), t, sessionState.car);
    await renderTile(item);

    await fireEvent.press(screen.getByRole('switch', { name: 'Hazard lights, Off' }));
    expect(sessionActions.toggle).toHaveBeenLastCalledWith('toggle.hazard', true);
  });

  it('reflects an active toggle', async () => {
    sessionState.activeToggles = ['toggle.hazard'];
    await renderTile(effectItem(effect('toggle.hazard'), t, sessionState.car));

    const tile = screen.getByRole('switch', { name: 'Hazard lights, On' });
    await fireEvent.press(tile);

    expect(tile.props.accessibilityState).toMatchObject({ checked: true });
    expect(sessionActions.toggle).toHaveBeenLastCalledWith('toggle.hazard', false);
  });

  it('opens the menu from the options button and on long press', async () => {
    const onMenuPress = await renderTile(presetItem(preset, t, true), 'small');

    await fireEvent.press(screen.getByRole('button', { name: 'More options for Double flash' }));
    await fireEvent(screen.getByRole('button', { name: /Double flash, Steps/ }), 'longPress');

    expect(onMenuPress).toHaveBeenCalledTimes(2);
  });

  it.each(['small', 'square', 'large'] as const)('renders the %s size', async (size) => {
    await renderTile(presetItem(preset, t, true), size);

    expect(screen.getByRole('button', { name: /^Double flash, Steps/ })).toBeTruthy();
  });
});
