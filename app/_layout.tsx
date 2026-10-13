import '@/global.css';
import '@/i18n';

import RootNavigator from '@/features/navigation/RootNavigator';
import { SessionProvider } from '@/session';
import AppProviders from '@/ui/AppProviders';

const RootLayout = () => (
  <AppProviders>
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  </AppProviders>
);

export default RootLayout;
