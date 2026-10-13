import { fireEvent, screen } from '@testing-library/react-native';

import '@/i18n';
import { useDraftStore } from '@/features/preset/draft-store';
import { renderScreen, resetRouter, routerMock } from '@/test-utils/mock-ui';
import { ICON_NAMES } from '@/ui/tile/icon-registry';

import IconPickerSheet from '.';

jest.mock('expo-router', () => jest.requireActual('@/test-utils/mock-ui').routerModule);

describe('IconPickerSheet', () => {
  beforeEach(() => {
    resetRouter();
    useDraftStore.getState().reset();
    useDraftStore.getState().setIcon('Lightning');
    useDraftStore.getState().setColor('rose');
  });

  it('offers every registry icon in five columns and marks the selected one', async () => {
    await renderScreen(<IconPickerSheet />);

    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(30);
    expect(screen.getByRole('radio', { name: 'Lightning' }).props.accessibilityState).toMatchObject(
      { checked: true },
    );
    expect(
      screen.getByRole('radio', { name: 'Headlights' }).props.accessibilityState,
    ).toMatchObject({ checked: false });
  });

  it('selects an icon', async () => {
    await renderScreen(<IconPickerSheet />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Headlights' }));

    expect(useDraftStore.getState().icon).toBe('Headlights');
  });

  it('filters by category', async () => {
    await renderScreen(<IconPickerSheet />);

    await fireEvent.press(screen.getByRole('tab', { name: 'Vehicle' }));

    expect(screen.getByRole('radio', { name: 'Steering wheel' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Headlights' })).toBeNull();
  });

  it('filters by the translated name', async () => {
    await renderScreen(<IconPickerSheet />);

    await fireEvent.changeText(screen.getByLabelText('Search icons'), 'siren');

    expect(screen.getByRole('radio', { name: 'Siren' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Headlights' })).toBeNull();
  });

  it('shows an empty state when nothing matches', async () => {
    await renderScreen(<IconPickerSheet />);

    await fireEvent.changeText(screen.getByLabelText('Search icons'), 'zzzz');

    expect(screen.getByText('No icons found')).toBeTruthy();
  });

  it('closes with Done', async () => {
    await renderScreen(<IconPickerSheet />);

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });
});
