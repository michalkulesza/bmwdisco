import { SquaresFour } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';

import ComingSoon from '@/ui/ComingSoon';

const LibraryScreen = () => {
  const { t } = useTranslation();

  return <ComingSoon icon={SquaresFour} title={t('library.title')} />;
};

export default LibraryScreen;
