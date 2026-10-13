import { fireEvent, render, screen } from '@testing-library/react-native';

import SegmentedControl from './SegmentedControl';

const OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

describe('SegmentedControl', () => {
  it('exposes a labelled radiogroup with the selected radio checked', async () => {
    await render(
      <SegmentedControl
        options={OPTIONS}
        value="dark"
        onChange={jest.fn()}
        accessibilityLabel="Theme"
      />,
    );

    expect(screen.getByLabelText('Theme').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByRole('radio', { name: 'Dark', checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Light', checked: false })).toBeTruthy();
  });

  it('reports the pressed option', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        options={OPTIONS}
        value="dark"
        onChange={onChange}
        accessibilityLabel="Theme"
      />,
    );

    await fireEvent.press(screen.getByRole('radio', { name: 'Light' }));

    expect(onChange).toHaveBeenCalledWith('light');
  });

  it('ignores presses on the selected option', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        options={OPTIONS}
        value="dark"
        onChange={onChange}
        accessibilityLabel="Theme"
      />,
    );

    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
