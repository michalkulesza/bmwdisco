import {
  PRESET_LIMITS,
  stepDurationMs,
  totalDurationMs,
  type Preset,
  type PresetStep,
} from '@/domain';

export type EditorStep = PresetStep & { key: string };

export type DraftIssueCode =
  'nameRequired' | 'noSteps' | 'tooManySteps' | 'stepTooShort' | 'tooLong' | 'loopPosition';

export interface DraftIssue {
  scope: 'name' | 'steps' | 'step';
  code: DraftIssueCode;
  stepKey?: string;
}

interface DraftContent {
  name: string;
  color: string;
  icon: string;
  steps: readonly EditorStep[];
  playback?: Preset['playback'];
}

let stepCounter = 0;

export const newStepKey = (): string => {
  stepCounter += 1;

  return `step-${stepCounter}`;
};

export const toEditorSteps = (steps: readonly PresetStep[]): EditorStep[] =>
  steps.map((step) => ({ ...step, key: newStepKey() }));

export const stripKeys = (steps: readonly EditorStep[]): PresetStep[] =>
  steps.map(({ key: _key, ...step }) => step);

export const buildPresetPayload = (draft: DraftContent, id: string): Preset => ({
  id,
  name: draft.name.trim(),
  color: draft.color,
  icon: draft.icon,
  steps: stripKeys(draft.steps),
  ...(draft.playback && draft.playback !== 'once' ? { playback: draft.playback } : {}),
});

export const draftTotalMs = (steps: readonly EditorStep[]): number =>
  totalDurationMs(stripKeys(steps));

const stepIsTooShort = (step: EditorStep): boolean => {
  if (step.type === 'wait') return step.ms < PRESET_LIMITS.minStepMs;

  if (step.type === 'loop') return false;
  return step.durationMs !== undefined && step.durationMs < PRESET_LIMITS.minStepMs;
};

export const validateDraft = (draft: DraftContent): DraftIssue[] => {
  const issues: DraftIssue[] = [];

  if (draft.name.trim().length === 0) issues.push({ scope: 'name', code: 'nameRequired' });
  if (draft.steps.length === 0) issues.push({ scope: 'steps', code: 'noSteps' });
  if (draft.steps.length > PRESET_LIMITS.maxSteps) {
    issues.push({ scope: 'steps', code: 'tooManySteps' });
  }

  draft.steps.filter(stepIsTooShort).forEach((step) => {
    issues.push({ scope: 'step', code: 'stepTooShort', stepKey: step.key });
  });

  draft.steps.forEach((step, index) => {
    if (step.type === 'loop' && (index !== draft.steps.length - 1 || index === 0)) {
      issues.push({ scope: 'step', code: 'loopPosition', stepKey: step.key });
    }
  });

  const total = draft.steps.reduce((sum, step) => sum + stepDurationMs(step), 0);
  if (total > PRESET_LIMITS.maxTotalMs) issues.push({ scope: 'steps', code: 'tooLong' });

  return issues;
};

export const ISSUE_PARAMS: Record<DraftIssueCode, Record<string, number>> = {
  nameRequired: {},
  noSteps: {},
  tooManySteps: { max: PRESET_LIMITS.maxSteps },
  stepTooShort: { min: PRESET_LIMITS.minStepMs },
  tooLong: { max: PRESET_LIMITS.maxTotalMs },
  loopPosition: {},
};

export const parseMs = (text: string): number | undefined => {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 0) return undefined;

  return Math.min(Number(digits), PRESET_LIMITS.maxTotalMs);
};

export const moveItem = <T>(items: readonly T[], from: number, to: number): T[] => {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(to, 0, moved);

  return next;
};
