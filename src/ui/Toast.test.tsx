import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button as RNButton } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/i18n';

import { ToastProvider, useToast } from './Toast';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const Trigger = () => {
  const toast = useToast();

  return (
    <RNButton
      title="show"
      onPress={() => toast.show({ title: 'Saved', description: 'Preset stored', tone: 'success' })}
    />
  );
};

describe('Toast', () => {
  it('shows an alert toast that can be dismissed', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ToastProvider>
          <Trigger />
        </ToastProvider>
      </SafeAreaProvider>,
    );

    await fireEvent.press(screen.getByText('show'));

    expect(JSON.stringify(screen.toJSON())).toContain('"accessibilityRole":"alert"');
    expect(screen.getByText('Saved')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
  });
});
