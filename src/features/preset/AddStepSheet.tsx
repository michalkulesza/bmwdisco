import { PlusCircle } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';

import ComingSoon from '@/ui/ComingSoon';

const AddStepSheet = () => {
  const { t } = useTranslation();

  return <ComingSoon icon={PlusCircle} title={t('preset.addStepTitle')} />;
};

export default AddStepSheet;
