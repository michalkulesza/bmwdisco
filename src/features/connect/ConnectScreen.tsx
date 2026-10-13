import { PlugsConnected } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';

import EmptyState from '@/ui/EmptyState';
import Screen from '@/ui/Screen';

const ConnectScreen = () => {
  const { t } = useTranslation();

  return (
    <Screen scroll={false} topInset>
      <EmptyState
        icon={PlugsConnected}
        title={t('connect.notConnected')}
        description={t('connect.subtitle')}
      />
    </Screen>
  );
};

export default ConnectScreen;
