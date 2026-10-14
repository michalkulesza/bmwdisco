import { render, screen } from '@testing-library/react-native';

import '@/i18n';

import Logo from './Logo';

describe('Logo', () => {
  it('renders with its accessibility label', async () => {
    await render(<Logo size={64} />);

    expect(screen.getByLabelText('BimmerDisco logo')).toBeTruthy();
  });
});
