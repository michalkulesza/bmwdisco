import { render, screen } from '@testing-library/react-native';

import '@/i18n';

import Copyright from './Copyright';

describe('Copyright', () => {
  it('renders the current year', async () => {
    await render(<Copyright />);

    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} KulaDajeFula Software`)).toBeTruthy();
  });
});
