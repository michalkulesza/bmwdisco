import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Screen from './Screen';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('Screen', () => {
  it.each([true, false])('renders children when scroll is %s', async (scroll) => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Screen scroll={scroll} topInset>
          <Text>Content</Text>
        </Screen>
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Content')).toBeTruthy();
  });
});
