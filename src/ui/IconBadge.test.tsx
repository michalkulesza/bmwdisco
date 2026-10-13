import { render, screen } from '@testing-library/react-native';
import { Lightning } from 'phosphor-react-native';

import IconBadge from './IconBadge';

describe('IconBadge', () => {
  it('is exposed as an image when labelled', async () => {
    await render(<IconBadge icon={Lightning} tone="amber" accessibilityLabel="Flash" />);

    expect(screen.getByRole('image', { name: 'Flash' })).toBeTruthy();
  });

  it('is hidden from accessibility when decorative', async () => {
    await render(<IconBadge icon={Lightning} />);

    expect(screen.queryByRole('image')).toBeNull();
  });
});
