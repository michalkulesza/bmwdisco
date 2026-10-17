import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { TimerIcon } from 'phosphor-react-native/src/icons/Timer';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { categoryOf } from '@/data/elements';
import { type PopoverTriggerProps } from '@/ui/Popover';
import SegmentedControl, { type SegmentedOption } from '@/ui/SegmentedControl';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';
import { translateKey } from '@/ui/tile/helpers';

import { categoryAppearance } from '../category-appearance';
import ElementWarning from '../ElementWarning';
import { ISSUE_PARAMS, type DraftIssueCode, type EditorStep } from '../helpers';
import LightPicker from '../LightPicker';
import MsInput from '../MsInput';

import StepCard from './StepCard';

import type { LightSelection } from '../light-selection';

type StepState = 'on' | 'off';

interface StepRowProps {
  step: EditorStep;
  number: number;
  issue: DraftIssueCode | undefined;
  onChange: (step: EditorStep) => void;
  onRemove: (key: string) => void;
}

const WaitHeader = () => {
  const { t } = useTranslation();
  const color = useColorToken('text-muted');

  return (
    <View className="flex-row items-center gap-2">
      <TimerIcon size={20} color={color} />
      <Text variant="bodyMedium">{t('preset.wait')}</Text>
    </View>
  );
};

type LightStep = Extract<EditorStep, { type: 'set' | 'action' }>;

interface ElementHeaderProps {
  step: LightStep;
  onChange: (step: EditorStep) => void;
}

const ElementHeader = ({ step, onChange }: ElementHeaderProps) => {
  const { t } = useTranslation();
  const muted = useColorToken('text-muted');
  const first = step.type === 'set' ? step.elements[0] : undefined;
  const actions = step.type === 'action' ? step.actions : [];
  const action = actions[0];
  const { icon: IconComponent, hue } = categoryAppearance(first ? categoryOf(first) : 'other');
  const color = useColorToken(hue);
  const elementName = action
    ? translateKey(t, `actions.names.${action}`)
    : first
      ? translateKey(t, `elements.${first}`)
      : '';
  const restCount =
    step.type === 'set' ? Math.max(step.elements.length - 1, 0) : Math.max(actions.length - 1, 0);
  const label = restCount
    ? t('preset.moreElements', { name: elementName, count: restCount })
    : elementName;

  const handleSelect = useCallback(
    (selection: LightSelection) =>
      onChange(
        selection.kind === 'legacy'
          ? {
              key: step.key,
              type: 'set',
              elements: [selection.id],
              state: step.state,
              ...(step.durationMs === undefined ? {} : { durationMs: step.durationMs }),
            }
          : {
              key: step.key,
              type: 'action',
              actions: [selection.id],
              state: step.state,
              ...(step.durationMs === undefined ? {} : { durationMs: step.durationMs }),
            },
      ),
    [onChange, step],
  );
  const renderTrigger = useCallback(
    (triggerProps: PopoverTriggerProps, { open }: { open: boolean }) => (
      <Pressable
        {...triggerProps}
        accessibilityRole="button"
        accessibilityLabel={t('preset.editStepLight', { name: label })}
        accessibilityState={{ expanded: open }}
        className="min-h-touch flex-row items-center gap-2 active:opacity-60"
      >
        <IconComponent size={20} color={color} />
        <Text variant="bodyMedium" numberOfLines={1} className="shrink">
          {label}
        </Text>
        {step.type === 'set' ? <ElementWarning elements={step.elements} /> : null}
        <CaretDownIcon size={14} color={muted} />
      </Pressable>
    ),
    [IconComponent, color, label, muted, step, t],
  );

  const value: LightSelection | undefined = first
    ? { kind: 'legacy', id: first }
    : action
      ? { kind: 'action', id: action }
      : undefined;
  return <LightPicker value={value} onSelect={handleSelect} trigger={renderTrigger} />;
};

const StepRow = ({ step, number, issue, onChange, onRemove }: StepRowProps) => {
  const { t } = useTranslation();
  const stateOptions: SegmentedOption<StepState>[] = useMemo(
    () => [
      { value: 'on', label: t('preset.on') },
      { value: 'off', label: t('preset.off') },
    ],
    [t],
  );
  const errorText = issue
    ? translateKey(t, `preset.errors.${issue}`, ISSUE_PARAMS[issue])
    : undefined;

  const handleRemove = useCallback(() => onRemove(step.key), [onRemove, step.key]);

  if (step.type === 'wait') {
    return (
      <StepCard
        number={number}
        header={<WaitHeader />}
        errorText={errorText}
        onRemove={handleRemove}
      >
        <MsInput
          value={step.ms}
          onChange={(ms) => onChange({ ...step, ms: ms ?? 0 })}
          accessibilityLabel={t('preset.waitLabel')}
          invalid={issue !== undefined}
        />
        <Text variant="meta" tone="muted">
          {t('preset.ms')}
        </Text>
      </StepCard>
    );
  }

  return (
    <StepCard
      number={number}
      header={<ElementHeader step={step} onChange={onChange} />}
      errorText={errorText}
      onRemove={handleRemove}
    >
      <SegmentedControl
        options={stateOptions}
        value={step.state}
        onChange={(state) => onChange({ ...step, state })}
        accessibilityLabel={t('preset.state')}
        className="w-28"
      />
      <Text variant="meta" tone="muted">
        {t('preset.step.for')}
      </Text>
      <MsInput
        value={step.durationMs}
        onChange={(durationMs) => onChange({ ...step, durationMs })}
        accessibilityLabel={t('preset.durationLabel')}
        invalid={issue !== undefined}
        allowEmpty
      />
      <Text variant="meta" tone="muted">
        {t('preset.ms')}
      </Text>
    </StepCard>
  );
};

export default memo(StepRow);
