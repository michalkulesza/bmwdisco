import { Check, PlugsConnected } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import type { SessionPhase } from '@/domain';
import { useSessionActions } from '@/session';
import { useSettingsStore } from '@/stores/settings';
import Button from '@/ui/Button';
import Screen from '@/ui/Screen';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

import CableFooter from './CableFooter';
import { connectSteps, type StepState } from './helpers';

const STEP_KEYS = ['reaching', 'identifying', 'loading'] as const;

interface StepIndicatorProps {
  state: StepState;
}

const StepIndicator = ({ state }: StepIndicatorProps) => {
  const accent = useColorToken('blue');
  const done = useColorToken('connected');

  if (state === 'active') return <ActivityIndicator size="small" color={accent} />;
  if (state === 'done') return <Check size={20} weight="bold" color={done} />;

  return <View className="size-5 rounded-pill border-2 border-radio-off" />;
};

interface StepRowProps {
  step: (typeof STEP_KEYS)[number];
  state: StepState;
}

const StepRow = ({ step, state }: StepRowProps) => {
  const { t } = useTranslation();
  const adapter = useSettingsStore((settings) => settings.adapter);
  const detail =
    step === 'reaching'
      ? `${t(`cable.adapters.${adapter}.name`)} · ${t(`cable.adapters.${adapter}.description`)}`
      : t(`connect.steps.${step}.detail`);

  return (
    <View
      accessibilityState={{ busy: state === 'active' }}
      className="min-h-[52px] flex-row items-center gap-3.5"
    >
      <View className="size-6 items-center justify-center">
        <StepIndicator state={state} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="bodyMedium" tone={state === 'pending' ? 'muted' : 'default'}>
          {t(`connect.steps.${step}.title`)}
        </Text>
        <Text variant="small" tone="muted">
          {detail}
        </Text>
      </View>
    </View>
  );
};

interface ConnectingViewProps {
  phase: SessionPhase;
}

const ConnectingView = ({ phase }: ConnectingViewProps) => {
  const { t } = useTranslation();
  const accent = useColorToken('blue');
  const { cancel } = useSessionActions();
  const steps = connectSteps(phase);
  const status = phase === 'connecting' ? 'reaching' : 'identifying';

  return (
    <Screen scroll={false} topInset>
      <View className="flex-1 items-center justify-center gap-9">
        <View className="size-24 items-center justify-center rounded-pill border border-line bg-card">
          <PlugsConnected size={40} color={accent} />
        </View>
        <View className="items-center gap-2">
          <Text variant="section" accessibilityRole="header">
            {t('connect.connecting')}
          </Text>
          <Text variant="meta" tone="muted" accessibilityLiveRegion="polite">
            {t(`connect.steps.${status}.status`)}
          </Text>
        </View>
        <View
          accessibilityLabel={t('connect.progress')}
          className="self-stretch gap-0 rounded-card border border-card-border bg-card px-4 py-2"
        >
          {STEP_KEYS.map((step, index) => (
            <View key={step}>
              {index > 0 ? <View className="ml-[38px] h-px bg-card-border" /> : null}
              <StepRow step={step} state={steps[index]!} />
            </View>
          ))}
        </View>
      </View>
      <View className="gap-3">
        <Button label={t('common.cancel')} variant="secondary" onPress={cancel} />
        <CableFooter />
      </View>
    </Screen>
  );
};

export default ConnectingView;
