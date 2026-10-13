import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';
import Screen from './Screen';

import type { Icon } from 'phosphor-react-native';

interface ComingSoonProps {
  icon: Icon;
  title: string;
  topInset?: boolean;
}

const ComingSoon = ({ icon, title, topInset }: ComingSoonProps) => {
  const { t } = useTranslation();

  return (
    <Screen scroll={false} topInset={topInset}>
      <EmptyState icon={icon} title={title} description={t('ui.placeholder')} />
    </Screen>
  );
};

export default ComingSoon;
