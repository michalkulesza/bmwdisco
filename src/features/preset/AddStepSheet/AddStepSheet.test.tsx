import { act, fireEvent, screen } from '@testing-library/react-native';

import '@/i18n';
import { fakeCar, resetSession, sessionState } from '@/test-utils/mock-session';
import { renderScreen, resetRouter, routerMock, searchParams } from '@/test-utils/mock-ui';

import { useDraftStore } from '../draft-store';
import { newStepKey } from '../helpers';

import AddStepSheet from '.';

jest.mock('@/session', () => jest.requireActual('@/test-utils/mock-session').sessionModule);
jest.mock('expo-router', () => jest.requireActual('@/test-utils/mock-ui').routerModule);

const steps = () => useDraftStore.getState().steps.map(({ key: _key, ...step }) => step);

const chooseLight = async (label: string) => {
  await fireEvent.press(screen.getByRole('button', { name: 'Light' }));
  await fireEvent.press(screen.getByRole('radio', { name: label }));
};

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

  it('only offers lights the car can drive, grouped by category', async () => {
    await renderScreen(<AddStepSheet />);

    await fireEvent.press(screen.getByRole('button', { name: 'Light' }));

    expect(screen.getAllByText('Front lights').length).toBeGreaterThan(0);
    expect(screen.getByText('Rear lights')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Tail light left' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Brake lights' })).toBeNull();
  });

  it('steps the duration by 50 ms and never goes below the minimum', async () => {
    await renderScreen(<AddStepSheet />);
    const input = screen.getByLabelText('Duration in milliseconds');

    await fireEvent.press(screen.getByRole('button', { name: 'Increase by 50 ms' }));
    expect(input.props.value).toBe('150');

    await fireEvent.press(screen.getByRole('button', { name: 'Decrease by 50 ms' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease by 50 ms' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease by 50 ms' }));
    expect(input.props.value).toBe('50');
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

  it('edits an existing step in place', async () => {
    const key = newStepKey();
    await act(async () => {
      useDraftStore.getState().addStep({
        key,
        type: 'set',
        elements: ['lowBeamAll'],
        state: 'on',
        durationMs: 300,
      });
    });
    searchParams.key = key;
    await renderScreen(<AddStepSheet />);

    expect(screen.getByText('Edit step')).toBeTruthy();
    await chooseLight('High beams');
    await fireEvent.press(screen.getByRole('button', { name: 'Save step' }));

    expect(steps()).toEqual([
      { type: 'set', elements: ['highBeamAll'], state: 'on', durationMs: 300 },
    ]);
    expect(useDraftStore.getState().steps[0]!.key).toBe(key);
  });

  it('closes without changes', async () => {
    await renderScreen(<AddStepSheet />);

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
    expect(steps()).toEqual([]);
  });
});
