import { useSettingsStore } from '@/stores/settings';

import { scrubBreadcrumb, scrubEvent, scrubText } from '../scrub';

import type { ErrorEvent } from '@sentry/react-native';

describe('scrubText', () => {
  afterEach(() => useSettingsStore.setState({ enetHost: '', thorHost: '192.168.0.10' }));

  it('removes 17-character VINs', () => {
    expect(scrubText('vin WBA3A5C50DF123456 read')).toBe('vin [VIN omitted] read');
  });

  it('keeps look-alikes that are not VINs', () => {
    expect(scrubText('WBA3A5C50DF12345 and WBA3A5C50DF1234567')).toBe(
      'WBA3A5C50DF12345 and WBA3A5C50DF1234567',
    );
  });

  it('removes IPv4 addresses', () => {
    expect(scrubText('connect 169.254.0.12:6801 failed')).toBe(
      'connect [host omitted]:6801 failed',
    );
  });

  it('removes configured adapter hostnames', () => {
    useSettingsStore.setState({ enetHost: 'gateway.local' });

    expect(scrubText('lookup gateway.local timed out')).toBe('lookup [host omitted] timed out');
  });
});

describe('scrubEvent', () => {
  it('scrubs the message, exception values and breadcrumbs', () => {
    const event = {
      type: undefined,
      message: 'VIN WBA3A5C50DF123456',
      exception: { values: [{ type: 'Error', value: 'socket 10.0.0.5 closed' }] },
      breadcrumbs: [{ message: 'tcp 192.168.1.20 open' }, { category: 'ui' }],
    } as ErrorEvent;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.message).toBe('VIN [VIN omitted]');
    expect(scrubbed.exception?.values?.[0]?.value).toBe('socket [host omitted] closed');
    expect(scrubbed.breadcrumbs?.[0]?.message).toBe('tcp [host omitted] open');
    expect(scrubbed.breadcrumbs?.[1]).toEqual({ category: 'ui', message: undefined });
  });

  it('passes events without text through', () => {
    expect(scrubEvent({ type: undefined } as ErrorEvent)).toMatchObject({ type: undefined });
  });

  it('scrubs breadcrumbs on their own', () => {
    expect(scrubBreadcrumb({ message: '10.1.2.3' }).message).toBe('[host omitted]');
  });
});
