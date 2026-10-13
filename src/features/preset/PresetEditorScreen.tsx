import { SlidersHorizontal } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';

import ComingSoon from '@/ui/ComingSoon';

const PresetEditorScreen = () => {
  const { t } = useTranslation();

  return <ComingSoon icon={SlidersHorizontal} title={t('preset.editTitle')} />;
};

export default PresetEditorScreen;
