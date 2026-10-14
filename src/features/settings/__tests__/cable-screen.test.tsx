import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/i18n';
import { useSettingsStore } from '@/stores/settings';

import CableScreen from '../CableScreen';

const mockRouter = { push: jest.fn() };

jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));

jest.mock('@/ui/haptics', () => ({ selectionHaptic: jest.fn() }));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderCable = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <CableScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({
    adapter: 'enet',
    enetHost: '',
    lastEnetHost: '',
    thorHost: '192.168.0.10',
    thorPort: '23',
    icarDevice: null,
    demoChassis: 'F32',
  });
});

describe('CableScreen', () => {
  it('lists the four adapters with ENET selected', async () => {
    await renderCable();

    for (const name of ['ENET', 'Thor', 'Vgate iCar', 'Demo']) {
      expect(screen.getByRole('radio', { name })).toBeTruthy();
    }
    expect(screen.getByRole('radio', { name: 'ENET', checked: true })).toBeTruthy();
  });

  it('shows the last working IP in the placeholder when the field is empty', async () => {
    useSettingsStore.setState({ lastEnetHost: '169.254.10.20' });

    await renderCable();

    expect(screen.getByPlaceholderText('Detect automatically (last: 169.254.10.20)')).toBeTruthy();
  });

  it('keeps the plain placeholder without a last working IP', async () => {
    await renderCable();

    expect(screen.getByPlaceholderText('Detect automatically')).toBeTruthy();
  });

  it('persists the selected adapter', async () => {
    await renderCable();

    await fireEvent.press(screen.getByRole('radio', { name: 'Thor' }));

    expect(useSettingsStore.getState().adapter).toBe('thor');
  });

  it('validates the optional ENET host', async () => {
    await renderCable();
    const input = screen.getByLabelText('Gateway address (optional)');

    await fireEvent.changeText(input, '8.8.8.8');
    expect(screen.getByText(/Enter a private IPv4 address/)).toBeTruthy();

    await fireEvent.changeText(input, '169.254.10.2');
    expect(screen.queryByText(/Enter a private IPv4 address/)).toBeNull();
    expect(useSettingsStore.getState().enetHost).toBe('169.254.10.2');
  });

  it('sets iOS-friendly input traits on the ENET host field', async () => {
    await renderCable();

    const input = screen.getByLabelText('Gateway address (optional)');

    expect(input.props.keyboardType).toBe('numbers-and-punctuation');
    expect(input.props.autoCapitalize).toBe('none');
    expect(input.props.autoCorrect).toBe(false);
    expect(input.props.textContentType).toBe('none');
  });

  it('shows Thor host and port with defaults and validates both', async () => {
    useSettingsStore.setState({ adapter: 'thor' });
    await renderCable();

    expect(screen.getByLabelText('Adapter address').props.value).toBe('192.168.0.10');
    expect(screen.getByLabelText('Port').props.value).toBe('23');
    expect(screen.getByLabelText('Port').props.keyboardType).toBe('number-pad');

    await fireEvent.changeText(screen.getByLabelText('Port'), '99999');
    expect(screen.getByText('Enter a port between 1 and 65535.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Adapter address'), '1.1.1.1');
    expect(screen.getByText(/Enter a private IPv4 address/)).toBeTruthy();
  });

  it('links the Vgate row to the device picker', async () => {
    useSettingsStore.setState({ adapter: 'vgate', icarDevice: { id: 'AA', name: 'My iCar' } });
    await renderCable();

    expect(screen.getByText('My iCar')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Adapter' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/settings/ble-devices');
  });

  it('links the Demo row to the chassis picker', async () => {
    useSettingsStore.setState({ adapter: 'demo' });
    await renderCable();

    await fireEvent.press(screen.getByRole('button', { name: 'Car' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/settings/demo-chassis');
  });
});
