import { act, fireEvent, screen } from '@testing-library/react-native';

import '@/i18n';
import { fakeCar, resetSession, sessionState } from '@/test-utils/mock-session';
import { renderScreen, resetRouter, routerMock, searchParams } from '@/test-utils/mock-ui';

import { useDraftStore } from '../draft-store';

import AddStepSheet from '.';

jest.mock('@/session', () => jest.requireActual('@/test-utils/mock-session').sessionModule);
jest.mock('expo-router', () => jest.requireActual('@/test-utils/mock-ui').routerModule);

const steps = () => useDraftStore.getState().steps.map(({ key: _key, ...step }) => step);

const chooseLight = async (label: string) => {
  await fireEvent.press(screen.getByRole('button', { name: 'Light' }));
  await fireEvent.press(screen.getByRole('radio', { name: label }));
};

const findModal = () => screen.root!.queryAll((node) => node.type === 'Modal')[0]!;

describe('AddStepSheet', () => {
  beforeEach(() => {
    resetSession();
    resetRouter();
    useDraftStore.getState().reset();
    sessionState.car = fakeCar(undefined, ['lowBeamAll', 'highBeamAll', 'hazard', 'tailLeft']);
  });

  it('adds a light action with the chosen light, state and duration', async () => {
    await renderScreen(<AddStepSheet />);

    await chooseLight('Hazard lights');
    await fireEvent.press(screen.getByRole('radio', { name: 'Off' }));
    await fireEvent.press(screen.getByRole('button', { name: '250 ms' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add to preset' }));

    expect(steps()).toEqual([{ type: 'set', elements: ['hazard'], state: 'off', durationMs: 250 }]);
    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  it('authors a semantic action step without storing it as a legacy element', async () => {
    await renderScreen(<AddStepSheet />);

    await fireEvent.press(screen.getByRole('button', { name: 'Light' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Both high beams' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add to preset' }));

    expect(steps()).toEqual([
      { type: 'action', actions: ['bothHighBeams'], state: 'on', durationMs: 100 },
    ]);
  });

  it('continues from the previous light after a wait and can switch it off directly', async () => {
    useDraftStore.getState().setSteps([
      { key: 'light', type: 'set', elements: ['tailLeft'], state: 'on', durationMs: 250 },
      { key: 'wait', type: 'wait', ms: 100 },
    ]);
    await renderScreen(<AddStepSheet />);

    expect(screen.getByRole('button', { name: 'Light' }).props.accessibilityValue.text).toBe(
      'Tail light left',
    );
    expect(screen.getByLabelText('Duration in milliseconds').props.value).toBe('250');
    await fireEvent.press(screen.getByRole('radio', { name: 'Off' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add to preset' }));
    expect(steps().at(-1)).toEqual({
      type: 'set',
      elements: ['tailLeft'],
      state: 'off',
      durationMs: 250,
    });
  });

  it('shows the infinity placeholder and a spoken label when the duration is empty', async () => {
    await renderScreen(<AddStepSheet />);
    const input = screen.getByLabelText('Duration in milliseconds');

    expect(screen.getByText('for')).toBeTruthy();
    expect(input.props.placeholder).toBe('∞');
    expect(input.props.accessibilityValue).toBeUndefined();

    await fireEvent.changeText(input, '');

    expect(input.props.value).toBe('');
    expect(input.props.accessibilityValue).toEqual({ text: 'Until changed' });
  });

  it('adds an until-changed block when the duration is cleared and restores a value on typing', async () => {
    await renderScreen(<AddStepSheet />);
    await chooseLight('Tail light left');
    const input = screen.getByLabelText('Duration in milliseconds');

    await fireEvent.changeText(input, '');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to preset' }));
    expect(steps()).toEqual([{ type: 'set', elements: ['tailLeft'], state: 'on' }]);

    await fireEvent.changeText(input, '300');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to preset' }));
    expect(steps().at(-1)).toEqual({
      type: 'set',
      elements: ['tailLeft'],
      state: 'on',
      durationMs: 300,
    });
  });

  it('steps up from empty to 100 ms and back down to empty', async () => {
    await renderScreen(<AddStepSheet />);
    const input = screen.getByLabelText('Duration in milliseconds');
    await fireEvent.changeText(input, '');

    await fireEvent.press(screen.getByRole('button', { name: 'Increase by 100 ms' }));
    expect(input.props.value).toBe('100');

    await fireEvent.press(screen.getByRole('button', { name: 'Decrease by 100 ms' }));
    expect(input.props.value).toBe('');
  });

  it('selects a duration chip from empty', async () => {
    await renderScreen(<AddStepSheet />);
    await fireEvent.changeText(screen.getByLabelText('Duration in milliseconds'), '');

    await fireEvent.press(screen.getByRole('button', { name: '100 ms' }));

    expect(screen.getByLabelText('Duration in milliseconds').props.value).toBe('100');
  });

  it('only offers lights the car can drive, grouped by category', async () => {
    await renderScreen(<AddStepSheet />);

    await fireEvent.press(screen.getByRole('button', { name: 'Light' }));

    expect(screen.getAllByText('Front lights').length).toBeGreaterThan(0);
    expect(screen.getByText('Rear lights')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Tail light left' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Brake lights' })).toBeNull();
  });

  it('floats the light list over the form without touching the other controls', async () => {
    await renderScreen(<AddStepSheet />);
    const trigger = () => screen.getByRole('button', { name: 'Light' });
    expect(trigger().props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.queryByRole('radio', { name: 'Hazard lights' })).toBeNull();

    await fireEvent.press(trigger());

    expect(trigger().props.accessibilityState).toMatchObject({ expanded: true });
    expect(screen.getByRole('radio', { name: 'Hazard lights' })).toBeTruthy();
    expect(findModal().props.visible).toBe(true);
    expect(screen.getByLabelText('Duration in milliseconds')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'On' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Off' })).toBeTruthy();
  });

  it('closes the light list after choosing a light', async () => {
    await renderScreen(<AddStepSheet />);

    await chooseLight('Hazard lights');

    expect(screen.queryByRole('radio', { name: 'Hazard lights' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Light' }).props.accessibilityValue.text).toBe(
      'Hazard lights',
    );
  });

  it('closes the light list on a system dismiss without changing the light', async () => {
    await renderScreen(<AddStepSheet />);
    const before = screen.getByRole('button', { name: 'Light' }).props.accessibilityValue.text;
    await fireEvent.press(screen.getByRole('button', { name: 'Light' }));

    await act(async () => findModal().props.onRequestClose());

    expect(screen.queryByRole('radio', { name: 'Hazard lights' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Light' }).props.accessibilityValue.text).toBe(
      before,
    );
  });

  it('steps a light duration by 100 ms down to until-changed', async () => {
    await renderScreen(<AddStepSheet />);
    const input = screen.getByLabelText('Duration in milliseconds');

    await fireEvent.press(screen.getByRole('button', { name: 'Increase by 100 ms' }));
    expect(input.props.value).toBe('200');

    await fireEvent.press(screen.getByRole('button', { name: 'Decrease by 100 ms' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease by 100 ms' }));
    expect(input.props.value).toBe('');
  });

  it('keeps the wait duration at the minimum when stepping down', async () => {
    searchParams.type = 'wait';
    await renderScreen(<AddStepSheet />);
    const input = screen.getByLabelText('Duration in milliseconds');

    await fireEvent.press(screen.getByRole('button', { name: 'Decrease by 100 ms' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease by 100 ms' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease by 100 ms' }));

    expect(input.props.value).toBe('50');
    expect(input.props.placeholder).toBeUndefined();
  });

  it('reuses an until-changed duration from the previous light', async () => {
    useDraftStore
      .getState()
      .setSteps([{ key: 'light', type: 'set', elements: ['tailLeft'], state: 'on' }]);
    await renderScreen(<AddStepSheet />);

    expect(screen.getByLabelText('Duration in milliseconds').props.value).toBe('');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to preset' }));

    expect(steps().at(-1)).toEqual({ type: 'set', elements: ['tailLeft'], state: 'on' });
  });

  it('adds a wait step without a light picker', async () => {
    await renderScreen(<AddStepSheet />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Wait' }));
    expect(screen.queryByRole('button', { name: 'Light' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '500 ms' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add to preset' }));

    expect(steps()).toEqual([{ type: 'wait', ms: 500 }]);
  });

  it('starts on the wait type when asked to', async () => {
    searchParams.type = 'wait';
    await renderScreen(<AddStepSheet />);

    expect(screen.getByRole('radio', { name: 'Wait' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it('disables adding while the duration is below the minimum', async () => {
    await renderScreen(<AddStepSheet />);

    await fireEvent.changeText(screen.getByLabelText('Duration in milliseconds'), '10');

    const add = screen.getByRole('button', { name: 'Add to preset' });
    expect(add.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(add);
    expect(steps()).toEqual([]);
  });

  it('ignores a step key param and always adds a new step', async () => {
    useDraftStore
      .getState()
      .setSteps([
        { key: 'existing', type: 'set', elements: ['lowBeamAll'], state: 'on', durationMs: 300 },
      ]);
    searchParams.key = 'existing';
    await renderScreen(<AddStepSheet />);

    expect(screen.getByText('Add step')).toBeTruthy();
    expect(screen.queryByText('Edit step')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save step' })).toBeNull();
    await chooseLight('High beams');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to preset' }));

    expect(steps()).toEqual([
      { type: 'set', elements: ['lowBeamAll'], state: 'on', durationMs: 300 },
      { type: 'set', elements: ['highBeamAll'], state: 'on', durationMs: 300 },
    ]);
    expect(useDraftStore.getState().steps[0]!.key).toBe('existing');
  });

  it('reuses the previous light and an until-changed duration for a new step', async () => {
    useDraftStore
      .getState()
      .setSteps([{ key: 'first', type: 'set', elements: ['hazard'], state: 'off' }]);
    await renderScreen(<AddStepSheet />);

    expect(screen.getByRole('button', { name: 'Light' }).props.accessibilityValue.text).toBe(
      'Hazard lights',
    );
    expect(screen.getByLabelText('Duration in milliseconds').props.value).toBe('');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to preset' }));

    expect(steps()[1]).toEqual({ type: 'set', elements: ['hazard'], state: 'off' });
  });

  it('closes without changes', async () => {
    await renderScreen(<AddStepSheet />);

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
    expect(steps()).toEqual([]);
  });
});
