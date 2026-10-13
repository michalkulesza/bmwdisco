import { act, fireEvent, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import '@/i18n';
import { SEED_PRESETS, usePresetsStore } from '@/stores/presets';
import { fakeCar, resetSession, sessionActions, sessionState } from '@/test-utils/mock-session';
import {
  renderScreen,
  reorderable,
  resetRouter,
  routerMock,
  searchParams,
  toastShow,
} from '@/test-utils/mock-ui';

import { useDraftStore } from '../draft-store';
import { newStepKey } from '../helpers';

import PresetEditorScreen from '.';

jest.mock('@/session', () => jest.requireActual('@/test-utils/mock-session').sessionModule);
jest.mock('expo-router', () => jest.requireActual('@/test-utils/mock-ui').routerModule);
jest.mock('@/ui/Toast', () => jest.requireActual('@/test-utils/mock-ui').toastModule);
jest.mock(
  'react-native-reorderable-list',
  () => jest.requireActual('@/test-utils/mock-ui').reorderableModule,
);

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

const openEditor = async (id: string) => {
  searchParams.id = id;
  await renderScreen(<PresetEditorScreen />);
};

const addLightStep = () =>
  act(async () => {
    useDraftStore.getState().addStep({
      key: newStepKey(),
      type: 'set',
      elements: ['lowBeamAll'],
      state: 'on',
      durationMs: 200,
    });
  });

describe('PresetEditorScreen', () => {
  beforeEach(() => {
    resetSession();
    resetRouter();
    toastShow.mockClear();
    alertSpy.mockClear();
    sessionState.car = fakeCar();
    usePresetsStore.setState({ presets: [...SEED_PRESETS] });
  });

  it('shows inline errors and does not save an empty preset', async () => {
    await openEditor('new');

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Enter a name')).toBeTruthy();
    expect(screen.getByText('Add at least one step')).toBeTruthy();
    expect(usePresetsStore.getState().presets).toHaveLength(SEED_PRESETS.length);
    expect(routerMock.back).not.toHaveBeenCalled();
  });

  it('creates a preset with a name, colour and steps', async () => {
    await openEditor('new');

    await fireEvent.changeText(screen.getByLabelText('Name'), '  Night pulse ');
    await fireEvent.press(screen.getByRole('radio', { name: 'Rose' }));
    await addLightStep();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    const created = usePresetsStore.getState().presets.at(-1)!;
    expect(created).toMatchObject({
      name: 'Night pulse',
      color: 'rose',
      steps: [{ type: 'set', elements: ['lowBeamAll'], state: 'on', durationMs: 200 }],
    });
    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  it('loads an existing preset and updates it', async () => {
    await openEditor('seed-double-flash');

    expect(screen.getByDisplayValue('Double flash')).toBeTruthy();
    expect(screen.getAllByLabelText(/^Light: /)).toHaveLength(4);

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Triple flash');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    const presets = usePresetsStore.getState().presets;
    expect(presets).toHaveLength(SEED_PRESETS.length);
    expect(presets[0]).toMatchObject({ id: 'seed-double-flash', name: 'Triple flash' });
  });

  it('deletes a step and updates the summary', async () => {
    await openEditor('seed-double-flash');
    expect(screen.getByText('Steps: 4')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete step 1' }));

    expect(screen.getByText('Steps: 3')).toBeTruthy();
    expect(screen.getByText('Total: 200 ms')).toBeTruthy();
  });

  it('flags a duration below the minimum and blocks saving', async () => {
    await openEditor('seed-double-flash');

    await fireEvent.changeText(screen.getAllByLabelText('Duration in milliseconds')[0]!, '10');

    expect(screen.getByText('Minimum is 50 ms')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(routerMock.back).not.toHaveBeenCalled();
    expect(usePresetsStore.getState().presets[0]!.steps[0]).toMatchObject({ durationMs: 100 });
  });

  it('flags a total duration over the limit', async () => {
    await openEditor('seed-double-flash');

    await fireEvent.changeText(screen.getAllByLabelText('Duration in milliseconds')[0]!, '60000');
    await fireEvent.changeText(screen.getAllByLabelText('Duration in milliseconds')[1]!, '60000');

    expect(screen.getByText('Total duration can be at most 90000 ms')).toBeTruthy();
  });

  it('reorders steps', async () => {
    await openEditor('seed-double-flash');
    const before = useDraftStore.getState().steps.map((step) => step.key);

    await act(async () => reorderable.props!.onReorder({ from: 0, to: 3 }));

    expect(useDraftStore.getState().steps.map((step) => step.key)).toEqual([
      before[1],
      before[2],
      before[3],
      before[0],
    ]);
  });

  it('adds a wait step through the editor shortcuts', async () => {
    await openEditor('new');

    await fireEvent.press(screen.getByRole('button', { name: 'Wait' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Action' }));

    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/preset/add-step',
      params: { type: 'wait' },
    });
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/preset/add-step',
      params: { type: 'set' },
    });
  });

  it('opens the icon picker', async () => {
    await openEditor('new');

    await fireEvent.press(screen.getByRole('button', { name: 'Icon' }));

    expect(routerMock.push).toHaveBeenCalledWith('/icon-picker');
  });

  it('asks before discarding unsaved changes', async () => {
    await openEditor('seed-double-flash');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Changed');

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(routerMock.back).not.toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0]![2] as AlertButton[];
    buttons.find((button) => button.style === 'destructive')!.onPress!();
    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  it('cancels straight away when nothing changed', async () => {
    await openEditor('seed-double-flash');

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(alertSpy).not.toHaveBeenCalled();
    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  it('tests the preset on the car', async () => {
    await openEditor('seed-double-flash');

    await fireEvent.press(screen.getByRole('button', { name: 'Test' }));

    expect(sessionActions.run).toHaveBeenCalledWith(SEED_PRESETS[0]);
  });

  it('stops the test while it is running', async () => {
    sessionState.runningItemId = 'seed-double-flash';
    await openEditor('seed-double-flash');

    await fireEvent.press(screen.getByRole('button', { name: 'Stop' }));

    expect(sessionActions.stop).toHaveBeenCalledTimes(1);
  });

  it('asks to connect before testing', async () => {
    sessionState.car = undefined;
    await openEditor('seed-double-flash');

    await fireEvent.press(screen.getByRole('button', { name: 'Test' }));

    expect(sessionActions.run).not.toHaveBeenCalled();
    expect(toastShow).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }));
  });

  it('reports a preset that no longer exists', async () => {
    await openEditor('gone');

    expect(screen.getByText('This preset no longer exists.')).toBeTruthy();
  });
});
