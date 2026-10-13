import { DotsThreeVertical } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';

import ComingSoon from '@/ui/ComingSoon';

const TileMenuSheet = () => {
  const { t } = useTranslation();

  return <ComingSoon icon={DotsThreeVertical} title={t('tileMenu.title')} />;
};

export default TileMenuSheet;
