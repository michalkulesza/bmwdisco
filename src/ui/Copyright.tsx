import { useTranslation } from 'react-i18next';

import Text from './Text';

const Copyright = () => {
  const { t } = useTranslation();

  return (
    <Text variant="small" tone="muted" className="mt-10 text-center">
      {t('common.copyright', { year: new Date().getFullYear() })}
    </Text>
  );
};

export default Copyright;
