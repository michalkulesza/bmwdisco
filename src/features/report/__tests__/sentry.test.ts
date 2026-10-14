import * as Sentry from '@sentry/react-native';

import { scrubBreadcrumb, scrubEvent } from '../scrub';
import { initSentry } from '../sentry';

const init = jest.mocked(Sentry.init);

describe('initSentry', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    init.mockClear();
  });

  it('does not initialise without a DSN', () => {
    initSentry();

    expect(init).not.toHaveBeenCalled();
  });

  it('initialises privately with scrubbing hooks when a DSN is set', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@o0.ingest.sentry.io/1';

    initSentry();

    expect(init).toHaveBeenCalledWith({
      dsn: 'https://key@o0.ingest.sentry.io/1',
      enabled: true,
      sendDefaultPii: false,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
  });
});
