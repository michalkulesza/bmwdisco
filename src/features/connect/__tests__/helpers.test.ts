import type { AdapterSettings } from '@/stores/settings';

import {
  adapterChoiceOf,
  chassisLabel,
  chassisOptions,
  connectSteps,
  isHostValid,
  maskVin,
  parsePort,
  toAdapterConfig,
  toErrorReason,
} from '../helpers';

const base: AdapterSettings = {
  adapter: 'enet',
  enetHost: '',
  thorHost: '192.168.0.10',
  thorPort: '23',
  icarDevice: null,
  demoChassis: 'F32',
};

describe('toAdapterConfig', () => {
  it('lets ENET discover the gateway when no host is set', () => {
    expect(toAdapterConfig(base)).toEqual({ adapter: 'enet' });
  });

  it('uses a valid manual ENET host and rejects public ones', () => {
    expect(toAdapterConfig({ ...base, enetHost: ' 169.254.1.1 ' })).toEqual({
      adapter: 'enet',
      host: '169.254.1.1',
    });
    expect(toAdapterConfig({ ...base, enetHost: '8.8.8.8' })).toBeUndefined();
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
    expect(connectSteps('connecting')).toEqual(['active', 'pending', 'pending']);
    expect(connectSteps('identifying')).toEqual(['done', 'active', 'pending']);
    expect(connectSteps('ready')).toEqual(['done', 'done', 'done']);
    expect(connectSteps('idle')).toEqual(['pending', 'pending', 'pending']);
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
