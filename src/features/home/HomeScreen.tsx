import { Lightbulb } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';

import ComingSoon from '@/ui/ComingSoon';

const HomeScreen = () => {
  const { t } = useTranslation();

  return <ComingSoon icon={Lightbulb} title={t('home.title')} />;
};

export default HomeScreen;
