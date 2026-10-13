import '@/global.css';
import '@/i18n';

import RootNavigator from '@/features/navigation/RootNavigator';
import AppProviders from '@/ui/AppProviders';

const RootLayout = () => (
  <AppProviders>
    <RootNavigator />
  </AppProviders>
);

export default RootLayout;
