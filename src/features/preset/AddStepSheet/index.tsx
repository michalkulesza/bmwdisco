import { useLocalSearchParams, useRouter } from 'expo-router';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ELEMENT_IDS } from '@/data/elements';
import { useSessionSelector } from '@/session';
import Button from '@/ui/Button';
import SegmentedControl, { type SegmentedOption } from '@/ui/SegmentedControl';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';
import { translateKey } from '@/ui/tile/helpers';

import { useDraftStore } from '../draft-store';
import MsInput from '../MsInput';

import DurationField from './DurationField';
import {
  buildStepFromForm,
  initialForm,
  isDurationTooShort,
  isFormValid,
  type StepFormValues,
  type StepType,
} from './helpers';
import LightField from './LightField';

import type { LightSelection } from '../light-selection';

type StepState = 'on' | 'off';

const AddStepSheet = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const close = useColorToken('text-muted');
  const { type } = useLocalSearchParams<{ type?: StepType }>();
  const addStep = useDraftStore((state) => state.addStep);
  const selectable = useSessionSelector(
    (snapshot) => snapshot.context.car?.selectableElements ?? ELEMENT_IDS,
  );
  const [form, setForm] = useState<StepFormValues>(() =>
    initialForm(type, useDraftStore.getState().steps, selectable),
  );

  const typeOptions: SegmentedOption<StepType>[] = useMemo(
    () => [
      { value: 'action', label: translateKey(t, 'actions.logical') },
      { value: 'set', label: translateKey(t, 'actions.legacy') },
      { value: 'wait', label: t('preset.step.wait') },
    ],
    [t],
  );
  const stateOptions: SegmentedOption<StepState>[] = useMemo(
    () => [
      { value: 'on', label: t('preset.on') },
      { value: 'off', label: t('preset.off') },
    ],
    [t],
  );

  const handleTypeChange = useCallback((next: StepType) => {
    setForm((current) => ({ ...current, type: next, element: undefined, action: undefined }));
  }, []);
  const handleStateChange = useCallback((state: StepState) => {
    setForm((current) => ({ ...current, state }));
  }, []);
  const handleDurationChange = useCallback((durationMs: number | undefined) => {
    setForm((current) => ({ ...current, durationMs }));
  }, []);
  const handleElementSelect = useCallback((selection: LightSelection) => {
    setForm((current) => ({
      ...current,
      element: selection.kind === 'legacy' ? selection.id : undefined,
      action: selection.kind === 'action' ? selection.id : undefined,
      type: selection.kind === 'legacy' ? 'set' : 'action',
    }));
  }, []);
  const handleClosePress = useCallback(() => router.back(), [router]);

  const handleSubmitPress = useCallback(() => {
    const step = buildStepFromForm(form);
    if (!step) return;

    addStep(step);
    router.back();
  }, [addStep, form, router]);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-5 px-4 pt-6"
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
    >
      <View className="flex-row items-center justify-between">
        <Text variant="section" accessibilityRole="header">
          {t('preset.addStepTitle')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={handleClosePress}
          className="size-touch items-center justify-center active:opacity-60"
        >
          <XIcon size={20} color={close} />
        </Pressable>
      </View>
      <SegmentedControl
        options={typeOptions}
        value={form.type}
        onChange={handleTypeChange}
        accessibilityLabel={t('preset.step.type')}
      />
      {form.type !== 'wait' ? (
        <>
          <LightField
            selected={
              form.type === 'action' && form.action
                ? { kind: 'action', id: form.action }
                : form.element
                  ? { kind: 'legacy', id: form.element }
                  : undefined
            }
            onSelect={handleElementSelect}
          />
          <View className="gap-2">
            <Text variant="meta" tone="muted">
              {t('preset.state')}
            </Text>
            <View className="flex-row items-center gap-3">
              <SegmentedControl
                options={stateOptions}
                value={form.state}
                onChange={handleStateChange}
                accessibilityLabel={t('preset.state')}
                className="w-32"
              />
              <Text variant="meta" tone="muted">
                {t('preset.step.for')}
              </Text>
              <MsInput
                value={form.durationMs}
                onChange={handleDurationChange}
                accessibilityLabel={t('preset.durationLabel')}
                allowEmpty
                invalid={isDurationTooShort(form.durationMs)}
              />
              <Text variant="meta" tone="muted">
                {t('preset.ms')}
              </Text>
            </View>
            <Text variant="small" tone="muted">
              {t('preset.step.stateHint')}
            </Text>
          </View>
          <DurationField
            value={form.durationMs}
            onChange={handleDurationChange}
            allowEmpty
            withInput={false}
          />
        </>
      ) : (
        <DurationField value={form.durationMs} onChange={handleDurationChange} />
      )}
      <Button
        label={t('preset.step.add')}
        onPress={handleSubmitPress}
        disabled={!isFormValid(form)}
      />
    </ScrollView>
  );
};

export default AddStepSheet;
