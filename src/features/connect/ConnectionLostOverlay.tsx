import { ArrowClockwise, Warning, WarningCircle } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_RECONNECT_ATTEMPTS } from '@/domain';
import { useCopyDiagnosticLog } from '@/features/settings/useCopyDiagnosticLog';
import { useSessionActions, useSessionPhase, useSessionSelector } from '@/session';
import Button from '@/ui/Button';
import IconBadge from '@/ui/IconBadge';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

import { useReconnect } from './useConnect';

interface BannerProps {
  attempt: number;
}

const Banner = ({ attempt }: BannerProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const amber = useColorToken('amber');

  return (
    <View
      accessibilityRole="alert"
      className="absolute inset-x-4 min-h-[52px] flex-row items-center gap-3 rounded-card border border-line bg-raised px-3.5 py-2.5"
      style={{ top: insets.top }}
    >
      <Warning size={22} weight="fill" color={amber} />
      <Text variant="labelStrong" className="flex-1">
        {t('connect.lost.banner')}
      </Text>
      <Text variant="small" className="text-hue-amber">
        {t('connect.lost.attempt', { attempt, max: MAX_RECONNECT_ATTEMPTS })}
      </Text>
    </View>
  );
};

interface ProgressRowProps {
  attempt: number;
}

const ProgressRow = ({ attempt }: ProgressRowProps) => {
  const { t } = useTranslation();
  const amber = useColorToken('amber');

  return (
    <View className="min-h-[52px] flex-row items-center gap-3 rounded-card bg-raised px-4">
      <ActivityIndicator size="small" color={amber} />
      <Text variant="bodyMedium" className="flex-1">
        {t('connect.lost.reconnecting')}
      </Text>
      <Text variant="meta" tone="muted">
        {t('connect.lost.attemptShort', { attempt, max: MAX_RECONNECT_ATTEMPTS })}
      </Text>
    </View>
  );
};

const ConnectionLostOverlay = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const phase = useSessionPhase();
  const lightsMayBeOn = useSessionSelector((snapshot) => snapshot.context.lightsMayBeOn);
  const whileRunning = useSessionSelector((snapshot) => snapshot.context.lastError?.whileRunning);
  const reconnectAttempt = useSessionSelector((snapshot) => snapshot.context.reconnectAttempt);
  const { disconnect } = useSessionActions();
  const reconnect = useReconnect();
  const copyDiagnosticLog = useCopyDiagnosticLog();
  const [dismissed, setDismissed] = useState(false);

  const reconnecting = phase === 'reconnecting';
  const stranded = lightsMayBeOn && (phase === 'error' || phase === 'disconnected');
  const visible = (reconnecting || stranded) && !dismissed;
  const attempt = Math.min(Math.max(reconnectAttempt, 1), MAX_RECONNECT_ATTEMPTS);

  if (dismissed && !reconnecting && !stranded) setDismissed(false);

  const secondaryLabel = reconnecting ? t('connect.lost.disconnect') : t('common.close');

  const handleSecondaryPress = useCallback(() => {
    if (reconnecting) disconnect();
    else setDismissed(true);
  }, [disconnect, reconnecting]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View accessibilityViewIsModal className="flex-1 justify-end bg-overlay">
        {reconnecting ? <Banner attempt={attempt} /> : null}
        <View
          className="gap-5 rounded-t-sheet border-t border-line bg-sheet px-4 pt-2"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="h-1.5 w-10 self-center rounded-pill bg-grip" />
          <View className="flex-row items-start gap-3.5">
            <IconBadge icon={WarningCircle} tone="amber" size="md" />
            <View className="flex-1 gap-1.5">
              <Text variant="section" accessibilityRole="header">
                {whileRunning ? t('connect.lost.titleRunning') : t('connect.lost.title')}
              </Text>
              {lightsMayBeOn ? (
                <Text variant="meta" tone="muted">
                  {t('connect.lost.lightsOn')}
                </Text>
              ) : null}
            </View>
          </View>
          {reconnecting ? <ProgressRow attempt={attempt} /> : null}
          <View className="gap-3">
            <Button label={t('connect.lost.reconnect')} icon={ArrowClockwise} onPress={reconnect} />
            <Button label={t('diagnostics.copy')} variant="secondary" onPress={copyDiagnosticLog} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={secondaryLabel}
              onPress={handleSecondaryPress}
              className="h-11 items-center justify-center active:opacity-60"
            >
              <Text variant="body" tone="muted">
                {secondaryLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ConnectionLostOverlay;
