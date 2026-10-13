import { fireEvent, render, screen } from '@testing-library/react-native';

import ListGroup from './ListGroup';
import ListRow from './ListRow';

describe('ListRow', () => {
  it('is a pressable button with label and value', async () => {
    const onPress = jest.fn();
    await render(
      <ListGroup>
        <ListRow label="Cable" value="ENET" chevron onPress={onPress} />
      </ListGroup>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Cable' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('ENET')).toBeTruthy();
  });

  it('acts as a radio when checked is provided', async () => {
    await render(
      <ListGroup>
        <ListRow label="English" checked onPress={jest.fn()} />
        <ListRow label="Polski" checked={false} onPress={jest.fn()} />
      </ListGroup>,
    );

    expect(screen.getByRole('radio', { name: 'English', checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Polski', checked: false })).toBeTruthy();
  });

  it('has no button role when it is not pressable', async () => {
    await render(<ListRow label="Version" value="0.1.0" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
