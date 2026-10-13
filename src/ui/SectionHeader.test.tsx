import { fireEvent, render, screen } from '@testing-library/react-native';

import SectionHeader from './SectionHeader';

describe('SectionHeader', () => {
  it('renders a header and an action link that fires onActionPress', async () => {
    const onActionPress = jest.fn();
    await render(
      <SectionHeader title="Favourites" actionLabel="Edit" onActionPress={onActionPress} />,
    );

    expect(screen.getByRole('header', { name: 'Favourites' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Edit' }));

    expect(onActionPress).toHaveBeenCalledTimes(1);
  });

  it('omits the action without a handler', async () => {
    await render(<SectionHeader title="Predefined" actionLabel="Edit" />);

    expect(screen.queryByRole('link')).toBeNull();
  });
});
