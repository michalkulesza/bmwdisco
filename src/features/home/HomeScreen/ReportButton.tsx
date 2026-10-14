import { Bug } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { useReportStore } from '@/features/report/store';
import { useColorToken } from '@/ui/theme';

const ReportButton = () => {
  const { t } = useTranslation();
  const openReport = useReportStore((state) => state.openReport);
  const color = useColorToken('text');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.reportProblem')}
      onPress={openReport}
      className="size-touch items-center justify-center active:opacity-60"
    >
      <Bug size={24} weight="bold" color={color} />
    </Pressable>
  );
};

export default ReportButton;
