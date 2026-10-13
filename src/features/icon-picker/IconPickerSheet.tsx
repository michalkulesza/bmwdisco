import { Shapes } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';

import ComingSoon from '@/ui/ComingSoon';

const IconPickerSheet = () => {
  const { t } = useTranslation();

  return <ComingSoon icon={Shapes} title={t('iconPicker.title')} />;
};

export default IconPickerSheet;
