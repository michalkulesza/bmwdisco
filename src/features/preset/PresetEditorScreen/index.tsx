import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import ReorderableList, { type ReorderableListReorderEvent } from 'react-native-reorderable-list';

import { presetSchema, PRESET_LIMITS, type PresetPlayback } from '@/domain';
import { assessRunnable, contextOf } from '@/domain/actions';
import { headerLeftOptions, headerRightOptions } from '@/features/navigation/headerItems';
import { useSessionActions, useSessionSelector } from '@/session';
import { createPresetId, usePresetsStore } from '@/stores/presets';
import EmptyState from '@/ui/EmptyState';
import SegmentedControl from '@/ui/SegmentedControl';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';
import { translateKey } from '@/ui/tile/helpers';
import { useToast } from '@/ui/Toast';

import { isDraftDirty, useDraftStore } from '../draft-store';
import {
  buildPresetPayload,
  draftTotalMs,
  ISSUE_PARAMS,
  moveItem,
  validateDraft,
  type DraftIssue,
  type EditorStep,
} from '../helpers';

import AppearanceCard from './AppearanceCard';
import BottomBar from './BottomBar';
import HeaderTextButton from './HeaderTextButton';
import NameField from './NameField';
import StepRow from './StepRow';

const DRAFT_TEST_ID = 'draft-preview';
const LIST_CONTENT_STYLE = { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 };
const LIST_STYLE = { flex: 1 };

const getStepKey = (step: EditorStep) => step.key;

const issueText = (issue: DraftIssue | undefined, t: ReturnType<typeof useTranslation>['t']) =>
  issue ? translateKey(t, `preset.errors.${issue.code}`, ISSUE_PARAMS[issue.code]) : undefined;

interface PresetEditorContentProps {
  presetId: string | undefined;
}

const PresetEditorContent = ({ presetId }: PresetEditorContentProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const pageColor = useColorToken('page');
  const { run, stop } = useSessionActions();
  const car = useSessionSelector((snapshot) => snapshot.context.car);
  const runningItemId = useSessionSelector((snapshot) => snapshot.context.runningItemId);
  const addPreset = usePresetsStore((state) => state.add);
  const updatePreset = usePresetsStore((state) => state.update);
  const name = useDraftStore((state) => state.name);
  const color = useDraftStore((state) => state.color);
  const icon = useDraftStore((state) => state.icon);
  const playback = useDraftStore((state) => state.playback);
  const setPlayback = useDraftStore((state) => state.setPlayback);
  const steps = useDraftStore((state) => state.steps);
  const setName = useDraftStore((state) => state.setName);
  const setColor = useDraftStore((state) => state.setColor);
  const setSteps = useDraftStore((state) => state.setSteps);
  const updateStep = useDraftStore((state) => state.updateStep);
  const removeStep = useDraftStore((state) => state.removeStep);
  const dirty = useDraftStore(isDraftDirty);
  const [submitted, setSubmitted] = useState(false);
  const [previewTried, setPreviewTried] = useState(false);

  const isNew = presetId === undefined;
  const testId = presetId ?? DRAFT_TEST_ID;
  const testing = runningItemId === testId;
  const draft = useMemo(
    () => ({ name, color, icon, steps, playback }),
    [name, color, icon, steps, playback],
  );
  const issues = useMemo(() => validateDraft(draft), [draft]);
  const nameIssue = issues.find((issue) => issue.scope === 'name');
  const stepsIssue = issues.find(
    (issue) => issue.scope === 'steps' && (submitted || previewTried || issue.code !== 'noSteps'),
  );
  const stepIssues = useMemo(
    () =>
      Object.fromEntries(
        issues
          .filter((issue) => issue.scope === 'step')
          .map((issue) => [issue.stepKey, issue.code]),
      ),
    [issues],
  );

  const handleCancelConfirmed = useCallback(() => router.back(), [router]);

  const handleCancelPress = useCallback(() => {
    if (!dirty) {
      router.back();

      return;
    }

    Alert.alert(t('preset.discardTitle'), t('preset.discardMessage'), [
      { text: t('preset.keepEditing'), style: 'cancel' },
      { text: t('preset.discard'), style: 'destructive', onPress: handleCancelConfirmed },
    ]);
  }, [dirty, handleCancelConfirmed, router, t]);

  const handleSavePress = useCallback(() => {
    setSubmitted(true);
    if (issues.length > 0) return;

    const payload = buildPresetPayload(draft, presetId ?? createPresetId());
    const result = isNew ? addPreset(payload) : updatePreset(payload);
    if (result.ok) {
      router.back();

      return;
    }

    const title =
      result.reason === 'limit'
        ? t('preset.errors.limit', { max: PRESET_LIMITS.maxPresets })
        : t('preset.errors.saveFailed');
    toast.show({ title, tone: 'error' });
  }, [addPreset, draft, isNew, issues.length, presetId, router, t, toast, updatePreset]);

  const handleTestPress = useCallback(() => {
    if (testing) {
      stop();

      return;
    }

    setPreviewTried(true);
    const parsed = presetSchema.safeParse(
      buildPresetPayload(
        {
          ...draft,
          name: draft.name.trim() || t('preset.previewName'),
        },
        testId,
      ),
    );
    if (!parsed.success) return;

    if (!car) {
      toast.show({ title: t('preset.testNeedsCar'), tone: 'error' });

      return;
    }

    const assessment = assessRunnable(contextOf(car), { kind: 'preset', preset: parsed.data });
    if (assessment.status !== 'runnable') {
      const reason = assessment.missing[0];
      const reasonKey =
        reason?.status === 'unknown'
          ? reason.reason
          : reason?.status === 'unsupported'
            ? reason.reason
            : 'noSemanticMapping';
      toast.show({ title: translateKey(t, `actions.reasons.${reasonKey}`), tone: 'error' });
      return;
    }

    run(parsed.data);
  }, [car, draft, run, stop, t, testId, testing, toast]);

  const handleAddAction = useCallback(
    () => router.push({ pathname: '/preset/add-step' }),
    [router],
  );
  const handleAddWait = useCallback(
    () => router.push({ pathname: '/preset/add-step', params: { type: 'wait' } }),
    [router],
  );
  const handleLoopConfirm = useCallback(() => setPlayback('loop'), [setPlayback]);

  const handlePlaybackChange = useCallback(
    (next: PresetPlayback) => {
      const hasWait = steps.some((step) => step.type === 'wait');
      if (next !== 'loop' || hasWait) {
        setPlayback(next);

        return;
      }

      Alert.alert(t('preset.playback.loopWarningTitle'), t('preset.playback.loopWarningMessage'), [
        { text: t('preset.playback.goBack'), style: 'cancel' },
        { text: t('preset.playback.useAnyway'), onPress: handleLoopConfirm },
      ]);
    },
    [handleLoopConfirm, setPlayback, steps, t],
  );

  const handleReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      setSteps(moveItem(steps, from, to));
    },
    [setSteps, steps],
  );

  const handleStepChange = useCallback(
    (step: EditorStep) => updateStep(step.key, step),
    [updateStep],
  );

  const renderStep = useCallback(
    ({ item, index }: { item: EditorStep; index: number }) => (
      <StepRow
        step={item}
        number={index + 1}
        issue={stepIssues[item.key]}
        onChange={handleStepChange}
        onRemove={removeStep}
      />
    ),
    [handleStepChange, removeStep, stepIssues],
  );

  const cancelHeaderOptions = useMemo(
    () =>
      headerLeftOptions(
        <HeaderTextButton label={t('common.cancel')} onPress={handleCancelPress} />,
      ),
    [handleCancelPress, t],
  );
  const saveHeaderOptions = useMemo(
    () =>
      headerRightOptions(
        <HeaderTextButton label={t('common.save')} onPress={handleSavePress} strong />,
      ),
    [handleSavePress, t],
  );

  const stepsIssueText = issueText(stepsIssue, t);
  const header = (
    <View className="gap-6 pb-4">
      <NameField
        name={name}
        color={color}
        icon={icon}
        errorText={submitted ? issueText(nameIssue, t) : undefined}
        onChangeName={setName}
      />
      <AppearanceCard color={color} icon={icon} onChangeColor={setColor} />
      <View className="gap-2">
        <Text variant="meta" tone="muted">
          {t('preset.playback.label')}
        </Text>
        <SegmentedControl
          value={playback}
          onChange={handlePlaybackChange}
          accessibilityLabel={t('preset.playback.label')}
          options={[
            { value: 'once', label: t('preset.playback.once') },
            { value: 'loop', label: t('preset.playback.loop') },
            { value: 'hold', label: t('preset.playback.hold') },
          ]}
        />
        <Text variant="small" tone="muted">
          {t(`preset.playback.${playback}Hint`)}
        </Text>
      </View>
      <View className="gap-1">
        <View className="flex-row items-baseline justify-between">
          <Text variant="section" accessibilityRole="header">
            {t('preset.steps')}
          </Text>
          <Text variant="small" tone="muted">
            {t('preset.reorderHint')}
          </Text>
        </View>
        {stepsIssueText ? (
          <Text variant="small" tone="destructive">
            {stepsIssueText}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-page">
      <Stack.Screen
        options={{
          title: isNew ? t('preset.newTitle') : t('preset.editTitle'),
          headerBackVisible: false,
          gestureEnabled: !dirty,
          headerStyle: { backgroundColor: pageColor },
          ...cancelHeaderOptions,
          ...saveHeaderOptions,
        }}
      />
      <ReorderableList
        data={steps}
        keyExtractor={getStepKey}
        renderItem={renderStep}
        onReorder={handleReorder}
        ListHeaderComponent={header}
        contentContainerStyle={LIST_CONTENT_STYLE}
        style={LIST_STYLE}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      />
      <BottomBar
        count={steps.length}
        totalMs={draftTotalMs(steps)}
        canAddStep={steps.length < PRESET_LIMITS.maxSteps}
        canTest
        testing={testing}
        onAction={handleAddAction}
        onWait={handleAddWait}
        onTest={handleTestPress}
      />
    </View>
  );
};

const PresetEditorScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = usePresetsStore((state) => state.presets.find((preset) => preset.id === id));
  const load = useDraftStore((state) => state.load);
  const reset = useDraftStore((state) => state.reset);
  const sourceId = useDraftStore((state) => state.sourceId);

  const handleClosePress = useCallback(() => router.back(), [router]);

  useEffect(() => {
    if (sourceId !== id) load(existing, id);
  }, [existing, id, load, sourceId]);

  useEffect(() => reset, [reset]);

  if (id !== 'new' && !existing) {
    return (
      <EmptyState
        icon={WarningCircleIcon}
        title={t('preset.notFound')}
        actionLabel={t('common.close')}
        onActionPress={handleClosePress}
      />
    );
  }

  return sourceId === id ? <PresetEditorContent presetId={existing?.id} /> : null;
};

export default PresetEditorScreen;
