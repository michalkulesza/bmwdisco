import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '@/stores/settings';
import Text from '@/ui/Text';

const CableFooter = () => {
  const { t } = useTranslation();
  const adapter = useSettingsStore((state) => state.adapter);

  return (
    <Text variant="small" tone="muted" className="mt-1 text-center">
      {t('connect.cable')}{' '}
      <Text variant="small" tone="soft">
        {t(`cable.adapters.${adapter}.name`)}
      </Text>
    </Text>
  );
};

export default CableFooter;
