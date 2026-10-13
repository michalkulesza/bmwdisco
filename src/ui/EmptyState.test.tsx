import { fireEvent, render, screen } from '@testing-library/react-native';
import { Plugs } from 'phosphor-react-native';

import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders a header, description and a pressable action', async () => {
    const onActionPress = jest.fn();
    await render(
      <EmptyState
        icon={Plugs}
        title="Not connected"
        description="Pick an adapter"
        actionLabel="Try again"
        onActionPress={onActionPress}
      />,
    );

    expect(screen.getByRole('header', { name: 'Not connected' })).toBeTruthy();
    expect(screen.getByText('Pick an adapter')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(onActionPress).toHaveBeenCalledTimes(1);
  });

  it('renders without an action', async () => {
    await render(<EmptyState icon={Plugs} title="Empty" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
