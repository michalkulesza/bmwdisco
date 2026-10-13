import { useLocalSearchParams, useRouter } from 'expo-router';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ELEMENT_IDS, type ElementId } from '@/data/elements';
import { useSessionSelector } from '@/session';
import Button from '@/ui/Button';
import SegmentedControl, { type SegmentedOption } from '@/ui/SegmentedControl';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';

import { useDraftStore } from '../draft-store';

import DurationField from './DurationField';
import ElementPicker from './ElementPicker';
import {
  buildStepFromForm,
  formFromStep,
  groupElements,
  isFormValid,
  type StepFormValues,
  type StepType,
} from './helpers';

type StepState = 'on' | 'off';

const AddStepSheet = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const close = useColorToken('text-muted');
  const { key, type } = useLocalSearchParams<{ key?: string; type?: StepType }>();
  const addStep = useDraftStore((state) => state.addStep);
  const updateStep = useDraftStore((state) => state.updateStep);
  const editedStep = useDraftStore((state) => state.steps.find((step) => step.key === key));
  const selectable = useSessionSelector(
    (snapshot) => snapshot.context.car?.selectableElements ?? ELEMENT_IDS,
  );
  const [form, setForm] = useState<StepFormValues>(() => {
    const previousLight = useDraftStore.getState().steps.findLast((step) => step.type === 'set');
    const initial = formFromStep(
      editedStep ?? (type === 'wait' ? undefined : previousLight),
      type === 'wait' ? 'wait' : 'set',
    );

    return {
      ...initial,
      element:
        initial.element && (editedStep || selectable.includes(initial.element))
          ? initial.element
          : selectable[0],
    };
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const rows = useMemo(() => groupElements(selectable), [selectable]);
  const typeOptions: SegmentedOption<StepType>[] = useMemo(
    () => [
      { value: 'set', label: t('preset.step.lightAction') },
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
  const isEditing = editedStep !== undefined;

  const handleTypeChange = useCallback((next: StepType) => {
    setForm((current) => ({ ...current, type: next }));
  }, []);
  const handleStateChange = useCallback((state: StepState) => {
    setForm((current) => ({ ...current, state }));
  }, []);
  const handleDurationChange = useCallback((durationMs: number | undefined) => {
    setForm((current) => ({ ...current, durationMs }));
  }, []);
  const handleElementSelect = useCallback((element: ElementId) => {
    setForm((current) => ({ ...current, element }));
    setPickerOpen(false);
  }, []);
  const handlePickerToggle = useCallback(() => setPickerOpen((open) => !open), []);
  const handleClosePress = useCallback(() => router.back(), [router]);

  const handleSubmitPress = useCallback(() => {
    const step = buildStepFromForm(form, editedStep?.key);
    if (!step) return;

    if (editedStep) updateStep(editedStep.key, step);
    else addStep(step);
    router.back();
  }, [addStep, editedStep, form, router, updateStep]);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-5 px-4 pt-6"
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
    >
      <View className="flex-row items-center justify-between">
        <Text variant="section" accessibilityRole="header">
          {isEditing ? t('preset.step.editTitle') : t('preset.addStepTitle')}
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
      {form.type === 'set' ? (
        <>
          <ElementPicker
            rows={rows}
            selected={form.element}
            open={pickerOpen}
            onToggle={handlePickerToggle}
            onSelect={handleElementSelect}
          />
          <View className="gap-2">
            <Text variant="meta" tone="muted">
              {t('preset.state')}
            </Text>
            <SegmentedControl
              options={stateOptions}
              value={form.state}
              onChange={handleStateChange}
              accessibilityLabel={t('preset.state')}
            />
          </View>
        </>
      ) : null}
      <DurationField value={form.durationMs} onChange={handleDurationChange} />
      <Button
        label={isEditing ? t('preset.step.update') : t('preset.step.add')}
        onPress={handleSubmitPress}
        disabled={!isFormValid(form)}
      />
    </ScrollView>
  );
};

export default AddStepSheet;
