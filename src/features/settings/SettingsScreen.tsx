import { Sliders } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';

import ComingSoon from '@/ui/ComingSoon';

const SettingsScreen = () => {
  const { t } = useTranslation();

  return <ComingSoon icon={Sliders} title={t('settings.title')} />;
};

export default SettingsScreen;
