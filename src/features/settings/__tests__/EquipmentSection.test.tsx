import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text as NativeText } from 'react-native';

import '@/i18n';
import { useSessionActions, useSessionSelector } from '@/session';
import { DEMO_CONFIG, renderWithSession } from '@/test-utils/session-ui';

import EquipmentSection from '../EquipmentSection';

const Harness = () => {
  const { connect } = useSessionActions();
  return (
    <>
      <Pressable accessibilityLabel="connect" onPress={() => connect(DEMO_CONFIG)} />
      <NativeText>Equipment test</NativeText>
      <SettingsFixture />
    </>
  );
};

const SettingsFixture = () => {
  const car = useSessionSelector((snapshot) => snapshot.context.car);
  return car ? <EquipmentSection car={car} /> : null;
};

it('offers equipment selection only when ready and sends a facts event without creating validation', async () => {
  await renderWithSession(<Harness />);

  expect(screen.queryByRole('radio', { name: 'Halogen' })).toBeNull();
  await fireEvent.press(screen.getByLabelText('connect'));
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Unknown' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('radio', { name: 'Halogen' }));

  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Halogen', checked: true })).toBeTruthy(),
  );
  expect(screen.getByText(/Selection alone does not verify a light command/)).toBeTruthy();
});
