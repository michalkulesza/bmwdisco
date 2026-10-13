import { Plugs } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';

import ComingSoon from '@/ui/ComingSoon';

const CableScreen = () => {
  const { t } = useTranslation();

  return <ComingSoon icon={Plugs} title={t('cable.title')} />;
};

export default CableScreen;
