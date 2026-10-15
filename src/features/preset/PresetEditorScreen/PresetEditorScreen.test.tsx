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

  it('saves the hold final state choice', async () => {
    await openEditor('new');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Continuous');
    await addLightStep();
    await fireEvent.press(screen.getByRole('radio', { name: 'Hold final state' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    const saved = usePresetsStore.getState().presets.find((preset) => preset.name === 'Continuous');
    expect(saved?.playback).toBe('hold');
  });

  it('tests an unnamed draft without changing its name and still requires a name to save', async () => {
    await openEditor('new');
    await addLightStep();
    await fireEvent.press(screen.getByRole('button', { name: 'Test' }));
    expect(sessionActions.run).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Preset preview' }),
    );
    expect(useDraftStore.getState().name).toBe('');
    expect(screen.queryByText('Enter a name')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a name')).toBeTruthy();
    expect(usePresetsStore.getState().presets).toHaveLength(SEED_PRESETS.length);
  });

  it('offers Run once, Loop and Hold final state and a bar of Action, Wait and Test', async () => {
    await openEditor('new');
    const labels = screen.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel);
    expect(labels).toEqual(expect.arrayContaining(['Run once', 'Loop', 'Hold final state']));
    expect(
      screen
        .getAllByRole('radio')
        .filter((radio) =>
          ['Run once', 'Loop', 'Hold final state'].includes(radio.props.accessibilityLabel),
        ),
    ).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Action' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wait' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Test' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Loop' })).toBeNull();
  });

  it('warns before selecting Loop without a Wait, and selects it only after confirmation', async () => {
    await openEditor('new');
    await addLightStep();
    await fireEvent.press(screen.getByRole('radio', { name: 'Loop' }));
    expect(alertSpy).toHaveBeenCalledWith(
      'Loop without a pause?',
      expect.any(String),
      expect.any(Array),
    );
    expect(useDraftStore.getState().playback).toBe('once');
    const buttons = alertSpy.mock.calls[0]![2]!;
    await act(async () => buttons.find((button) => button.text === 'Use Loop anyway')!.onPress!());
    expect(useDraftStore.getState().playback).toBe('loop');
  });

  it('selects Loop after a Wait without a warning and saves the playback', async () => {
    await openEditor('new');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Repeating');
    await addLightStep();
    await act(async () =>
      useDraftStore.getState().addStep({ key: newStepKey(), type: 'wait', ms: 500 }),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Loop' }));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(useDraftStore.getState().playback).toBe('loop');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    const saved = usePresetsStore.getState().presets.find((preset) => preset.name === 'Repeating');
    expect(saved?.playback).toBe('loop');
    expect(saved?.steps.some((step) => step.type !== 'set' && step.type !== 'wait')).toBe(false);
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

  it('lets a light step duration be cleared to until changed and typed again', async () => {
    await openEditor('new');
    await addLightStep();
    const input = screen.getByLabelText('Duration in milliseconds');

    expect(screen.getByText('for')).toBeTruthy();
    expect(input.props.placeholder).toBe('∞');

    await fireEvent.changeText(input, '');
    expect(useDraftStore.getState().steps[0]!.type).toBe('set');
    expect(useDraftStore.getState().steps[0]).toHaveProperty('durationMs', undefined);
    expect(screen.getByLabelText('Duration in milliseconds').props.value).toBe('');
    expect(screen.queryByText('Minimum is 50 ms')).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Duration in milliseconds'), '350');
    expect(useDraftStore.getState().steps[0]).toMatchObject({ durationMs: 350 });
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

  it('changes a step light from the dropdown without navigating', async () => {
    sessionState.car = fakeCar(undefined, ['lowBeamAll', 'highBeamAll', 'hazard']);
    await openEditor('new');
    await addLightStep();
    const keyBefore = useDraftStore.getState().steps[0]!.key;

    const trigger = screen.getByRole('button', { name: 'Light: Low beams' });
    expect(trigger.props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(trigger);
    expect(
      screen.getByRole('button', { name: 'Light: Low beams' }).props.accessibilityState,
    ).toMatchObject({
      expanded: true,
    });
    expect(screen.queryByRole('radio', { name: 'Tail light left' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'High beams' }));

    const [step] = useDraftStore.getState().steps;
    expect(step).toEqual({
      key: keyBefore,
      type: 'set',
      elements: ['highBeamAll'],
      state: 'on',
      durationMs: 200,
    });
    expect(screen.getByRole('button', { name: 'Light: High beams' })).toBeTruthy();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('closes the dropdown from the full-screen backdrop and toggles on the trigger', async () => {
    await openEditor('new');
    await addLightStep();
    const trigger = () => screen.getByRole('button', { name: 'Light: Low beams' });

    await fireEvent.press(trigger());
    expect(screen.getByTestId('popover-root')).toHaveStyle({ flex: 1 });
    expect(screen.getByRole('radio', { name: 'High beams' })).toBeTruthy();
    expect(trigger().props.accessibilityState).toMatchObject({ expanded: true });

    await fireEvent.press(screen.getByTestId('popover-backdrop', { hidden: true }));

    expect(screen.queryByRole('radio', { name: 'High beams' })).toBeNull();
    expect(trigger().props.accessibilityState).toMatchObject({ expanded: false });
    expect(useDraftStore.getState().steps[0]).toMatchObject({ elements: ['lowBeamAll'] });
  });

  it('edits a wait step duration inline', async () => {
    await openEditor('new');
    await act(async () => {
      useDraftStore.getState().addStep({ key: 'w', type: 'wait', ms: 100 });
    });

    await fireEvent.changeText(screen.getByLabelText('Wait in milliseconds'), '450');

    expect(useDraftStore.getState().steps[0]).toEqual({ key: 'w', type: 'wait', ms: 450 });
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
