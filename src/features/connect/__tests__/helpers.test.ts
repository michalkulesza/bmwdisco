import { Platform } from 'react-native';

import { adapterChoicesForPlatform, type AdapterSettings } from '@/stores/settings';

import {
  adapterChoiceOf,
  chassisLabel,
  chassisOptions,
  isHostValid,
  maskVin,
  parsePort,
  reachedSteps,
  stepStates,
  toAdapterConfig,
  toErrorReason,
} from '../helpers';

const base: AdapterSettings = {
  adapter: 'enet',
  enetHost: '',
  lastEnetHost: '',
  thorHost: '192.168.0.10',
  thorPort: '23',
  icarDevice: null,
  demoChassis: 'F32',
};

describe('toAdapterConfig', () => {
  it('preserves iOS choices and blocks stored Android-only adapters', () => {
    expect(adapterChoicesForPlatform('ios')).toEqual(['enet', 'thor', 'vgate', 'demo']);
    const platform = jest.replaceProperty(Platform, 'OS', 'ios');
    expect(toAdapterConfig({ ...base, adapter: 'elmWifi' })).toBeUndefined();
    expect(
      toAdapterConfig({ ...base, adapter: 'usb', usbDevice: { id: '1', name: null } }),
    ).toBeUndefined();
    platform.restore();
  });

  it('configures Android ELM Wi-Fi independently from Thor', () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'android');
    expect(toAdapterConfig({ ...base, adapter: 'elmWifi' })).toEqual({
      adapter: 'elm-wifi',
      host: '192.168.0.10',
      port: 35000,
    });
    expect(
      toAdapterConfig({ ...base, adapter: 'elmWifi', elmWifiHost: '8.8.8.8' }),
    ).toBeUndefined();
    expect(toAdapterConfig({ ...base, adapter: 'elmWifi', elmWifiPort: '0' })).toBeUndefined();
    expect(toAdapterConfig({ ...base, adapter: 'thor' })).toEqual({
      adapter: 'thor',
      host: '192.168.0.10',
      port: 23,
    });
    platform.restore();
  });

  it('requires independent selected devices for Android Classic and USB', () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'android');
    expect(toAdapterConfig({ ...base, adapter: 'elmBluetooth' })).toBeUndefined();
    expect(toAdapterConfig({ ...base, adapter: 'usb' })).toBeUndefined();
    expect(
      toAdapterConfig({
        ...base,
        adapter: 'elmBluetooth',
        elmBluetoothDevice: { id: 'AA:BB', name: 'ELM' },
      }),
    ).toEqual({ adapter: 'elm-bluetooth', deviceId: 'AA:BB' });
    expect(
      toAdapterConfig({ ...base, adapter: 'usb', usbDevice: { id: '12', name: 'USB' } }),
    ).toEqual({ adapter: 'usb', deviceId: '12' });
    platform.restore();
  });
  it('lets ENET discover the gateway when no host is set', () => {
    expect(toAdapterConfig(base)).toEqual({ adapter: 'enet' });
    expect(toAdapterConfig({ ...base, lastEnetHost: ' 169.254.2.2 ' })).toEqual({
      adapter: 'enet',
      preferredHost: '169.254.2.2',
    });
    expect(toAdapterConfig({ ...base, lastEnetHost: '8.8.8.8' })).toEqual({ adapter: 'enet' });
  });

  it('uses a valid manual ENET host and rejects public ones', () => {
    expect(toAdapterConfig({ ...base, enetHost: ' 169.254.1.1 ' })).toEqual({
      adapter: 'enet',
      host: '169.254.1.1',
    });
    expect(toAdapterConfig({ ...base, enetHost: '8.8.8.8' })).toBeUndefined();
    expect(
      toAdapterConfig({ ...base, enetHost: '169.254.1.1', lastEnetHost: '169.254.2.2' }),
    ).toEqual({
      adapter: 'enet',
      host: '169.254.1.1',
    });
  });

  it('builds the Thor config with defaults and validates host and port', () => {
    const thor = { ...base, adapter: 'thor' as const };

    expect(toAdapterConfig(thor)).toEqual({ adapter: 'thor', host: '192.168.0.10', port: 23 });
    expect(toAdapterConfig({ ...thor, thorHost: '' })).toMatchObject({ host: '192.168.0.10' });
    expect(toAdapterConfig({ ...thor, thorHost: '1.1.1.1' })).toBeUndefined();
    expect(toAdapterConfig({ ...thor, thorPort: '70000' })).toBeUndefined();
  });

  it('needs a chosen device for the iCar and always resolves the demo car', () => {
    expect(toAdapterConfig({ ...base, adapter: 'vgate' })).toBeUndefined();
    expect(
      toAdapterConfig({ ...base, adapter: 'vgate', icarDevice: { id: 'AB', name: null } }),
    ).toEqual({ adapter: 'icar', deviceId: 'AB' });
    expect(toAdapterConfig({ ...base, adapter: 'demo' })).toEqual({
      adapter: 'demo',
      chassis: 'F32',
    });
  });
});

describe('helpers', () => {
  it('validates hosts and ports', () => {
    expect(isHostValid('')).toBe(true);
    expect(isHostValid('192.168.1.1')).toBe(true);
    expect(isHostValid('example.com')).toBe(false);
    expect(parsePort('23')).toBe(23);
    expect(parsePort('0')).toBeUndefined();
    expect(parsePort('abc')).toBeUndefined();
  });

  it('maps phases to step states', () => {
    expect(reachedSteps('connecting')).toBe(0);
    expect(reachedSteps('identifying')).toBe(1);
    expect(reachedSteps('ready')).toBe(3);
    expect(reachedSteps('idle')).toBe(0);
    expect(stepStates(0)).toEqual(['active', 'pending', 'pending']);
    expect(stepStates(1)).toEqual(['done', 'active', 'pending']);
    expect(stepStates(3)).toEqual(['done', 'done', 'done']);
  });

  it('masks the VIN except the last seven characters', () => {
    expect(maskVin('WBA1234567G123456')).toBe('••••••••••G123456');
  });

  it('falls back to adapterUnreachable for unknown reasons', () => {
    expect(toErrorReason('carNotResponding')).toBe('carNotResponding');
    expect(toErrorReason('timeout')).toBe('adapterUnreachable');
    expect(toErrorReason(undefined)).toBe('adapterUnreachable');
  });

  it('labels chassis codes and lists every generated chassis once', () => {
    expect(chassisLabel('F32')).toBe('F32 · 4 Series');
    expect(chassisLabel('ZZZ')).toBe('ZZZ');
    const codes = chassisOptions().map((option) => option.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('F32');
  });

  it('maps adapter ids back to settings choices', () => {
    expect(adapterChoiceOf('icar')).toBe('vgate');
    expect(adapterChoiceOf(undefined)).toBeUndefined();
  });
});
