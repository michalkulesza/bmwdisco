import '@/global.css';
import '@/i18n';

import * as Sentry from '@sentry/react-native';

import RootNavigator from '@/features/navigation/RootNavigator';
import { initSentry } from '@/features/report/sentry';
import { SessionProvider } from '@/session';
import AppProviders from '@/ui/AppProviders';

initSentry();

const RootLayout = () => (
  <AppProviders>
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  </AppProviders>
);

export default Sentry.wrap(RootLayout);
