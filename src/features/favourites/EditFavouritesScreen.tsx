import { Star } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';

import ComingSoon from '@/ui/ComingSoon';

const EditFavouritesScreen = () => {
  const { t } = useTranslation();

  return <ComingSoon icon={Star} title={t('favourites.editTitle')} />;
};

export default EditFavouritesScreen;
