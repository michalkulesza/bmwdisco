import { PaperPlaneTilt, X } from 'phosphor-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import Button from '@/ui/Button';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

import type { ReportStatus } from './useSendReport';

interface ReportFormProps {
  message: string;
  status: ReportStatus;
  onChangeMessage: (message: string) => void;
  onSend: () => void;
  onClose: () => void;
}

const ErrorMessage = ({ status }: { status: ReportStatus }) => {
  const { t } = useTranslation();

  if (status !== 'notConfigured' && status !== 'failed') return null;

  const key = status === 'notConfigured' ? 'report.errorNotConfigured' : 'report.errorFailed';

  return (
    <Text variant="small" tone="destructive" accessibilityRole="alert">
      {t(key)}
    </Text>
  );
};

const ReportForm = ({ message, status, onChangeMessage, onSend, onClose }: ReportFormProps) => {
  const { t } = useTranslation();
  const mutedColor = useColorToken('text-muted');
  const sending = status === 'sending';

  const handleSendPress = useCallback(() => onSend(), [onSend]);

  return (
    <>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1.5">
          <Text variant="heading" accessibilityRole="header">
            {t('report.title')}
          </Text>
          <Text variant="meta" tone="muted">
            {t('report.description')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          className="-mr-2.5 -mt-2.5 size-touch items-center justify-center active:opacity-60"
        >
          <X size={20} color={mutedColor} />
        </Pressable>
      </View>
      <TextInput
        accessibilityLabel={t('report.messageLabel')}
        value={message}
        onChangeText={onChangeMessage}
        editable={!sending}
        placeholder={t('report.placeholder')}
        placeholderTextColor={mutedColor}
        multiline
        textAlignVertical="top"
        autoCorrect
        autoCapitalize="sentences"
        className="min-h-[120px] rounded-card border border-line bg-page px-3.5 py-3 font-geist text-body text-ink"
      />
      <ErrorMessage status={status} />
      <View className="flex-row gap-2.5">
        <Button
          label={t('common.close')}
          variant="secondary"
          onPress={onClose}
          className="flex-1"
        />
        <Button
          label={t('report.send')}
          icon={PaperPlaneTilt}
          loading={sending}
          onPress={handleSendPress}
          className="flex-1"
        />
      </View>
    </>
  );
};

export default ReportForm;
