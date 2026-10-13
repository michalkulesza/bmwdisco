import { fireEvent, render, screen } from '@testing-library/react-native';

import Button from './Button';

describe('Button', () => {
  it('exposes a button role and label, and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('prefers an explicit accessibility label', async () => {
    await render(<Button label="Save" accessibilityLabel="Save preset" onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Save preset' })).toBeTruthy();
  });

  it.each(['secondary', 'destructive', 'pill'] as const)(
    'renders the %s variant',
    async (variant) => {
      await render(<Button label="Go" variant={variant} onPress={jest.fn()} />);

      expect(screen.getByText('Go')).toBeTruthy();
    },
  );

  it('does not fire onPress while disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" disabled onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not fire onPress while loading', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" loading onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).not.toHaveBeenCalled();
  });
});
