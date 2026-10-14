import { CheckCircle } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import Button from '@/ui/Button';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

const ReportSent = ({ onDone }: { onDone: () => void }) => {
  const { t } = useTranslation();
  const connected = useColorToken('connected');

  return (
    <>
      <View className="items-center gap-2.5 pb-1 pt-3">
        <CheckCircle size={44} weight="fill" color={connected} />
        <Text variant="heading" accessibilityRole="header">
          {t('report.sentTitle')}
        </Text>
        <Text variant="meta" tone="muted" className="text-center">
          {t('report.sentBody')}
        </Text>
      </View>
      <Button label={t('common.done')} onPress={onDone} />
    </>
  );
};

export default ReportSent;
