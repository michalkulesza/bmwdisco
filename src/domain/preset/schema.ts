import { z } from 'zod';

import { isElementId, type ElementId } from '@/data/elements';
import { isLogicalActionId, type LogicalActionId } from '@/domain/actions/catalog';

import { InvalidPresetError } from '../errors';

import { PRESET_FILE_FORMAT, PRESET_FILE_VERSION, PRESET_LIMITS } from './limits';

import type { Preset, PresetStep } from './types';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const COLOR_PATTERN = /^[a-z][A-Za-z0-9]{0,23}$/;
const ICON_PATTERN = /^[A-Z][A-Za-z0-9]{0,39}$/;

const elementSchema = z.string().refine((value): value is ElementId => isElementId(value), {
  message: 'unknown element',
});

const durationSchema = z.number().int().min(PRESET_LIMITS.minStepMs).max(PRESET_LIMITS.maxTotalMs);

const setStepSchema = z.strictObject({
  type: z.literal('set'),
  elements: z.array(elementSchema).min(1).max(PRESET_LIMITS.maxElementsPerStep),
  state: z.enum(['on', 'off']),
  durationMs: durationSchema.optional(),
});

const waitStepSchema = z.strictObject({
  type: z.literal('wait'),
  ms: durationSchema,
});

const actionSchema = z
  .string()
  .refine((value): value is LogicalActionId => isLogicalActionId(value), {
    message: 'unknown action',
  });

const actionStepSchema = z.strictObject({
  type: z.literal('action'),
  actions: z.array(actionSchema).min(1).max(PRESET_LIMITS.maxElementsPerStep),
  state: z.enum(['on', 'off']),
  durationMs: durationSchema.optional(),
});

const stepSchema = z.discriminatedUnion('type', [setStepSchema, actionStepSchema, waitStepSchema]);
const legacyStepSchema = z.discriminatedUnion('type', [setStepSchema, waitStepSchema]);

export const stepDurationMs = (step: PresetStep): number =>
  step.type === 'wait' ? step.ms : (step.durationMs ?? 0);

export const totalDurationMs = (steps: readonly PresetStep[]): number =>
  steps.reduce((total, step) => total + stepDurationMs(step), 0);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const migrateLegacyLoop = (value: unknown): unknown => {
  if (!isRecord(value) || !Array.isArray(value.steps)) return value;

  const last: unknown = value.steps.at(-1);
  if (!isRecord(last) || last.type !== 'loop') return value;

  return { ...value, steps: value.steps.slice(0, -1), playback: 'loop' };
};

export const presetSchema = z.preprocess(
  migrateLegacyLoop,
  z
    .strictObject({
      id: z.string().regex(ID_PATTERN),
      name: z.string().trim().min(1).max(PRESET_LIMITS.maxNameLength),
      color: z.string().regex(COLOR_PATTERN),
      icon: z.string().regex(ICON_PATTERN),
      playback: z.enum(['once', 'loop', 'hold']).optional(),
      steps: z.array(stepSchema).min(1).max(PRESET_LIMITS.maxSteps),
    })
    .refine((preset) => totalDurationMs(preset.steps) <= PRESET_LIMITS.maxTotalMs, {
      message: 'total duration exceeds the limit',
      path: ['steps'],
    }),
);

const presetFileBase = {
  format: z.literal(PRESET_FILE_FORMAT),
  version: z.number().int(),
  presets: z.array(z.unknown()).max(PRESET_LIMITS.maxPresets),
};

export const presetFileSchema = z.discriminatedUnion('version', [
  z.strictObject({ ...presetFileBase, version: z.literal(1) }),
  z.strictObject({ ...presetFileBase, version: z.literal(PRESET_FILE_VERSION) }),
]);

const legacyPresetSchema = z.preprocess(
  migrateLegacyLoop,
  z
    .strictObject({
      id: z.string().regex(ID_PATTERN),
      name: z.string().trim().min(1).max(PRESET_LIMITS.maxNameLength),
      color: z.string().regex(COLOR_PATTERN),
      icon: z.string().regex(ICON_PATTERN),
      playback: z.enum(['once', 'loop', 'hold']).optional(),
      steps: z.array(legacyStepSchema).min(1).max(PRESET_LIMITS.maxSteps),
    })
    .refine((preset) => totalDurationMs(preset.steps as PresetStep[]) <= PRESET_LIMITS.maxTotalMs, {
      message: 'total duration exceeds the limit',
      path: ['steps'],
    }),
);

export const describeIssues = (error: z.ZodError): string[] =>
  error.issues.map((issue) => `${issue.path.join('.') || 'preset'}: ${issue.message}`);

export const importedPresetSchema = (version: 1 | 2) =>
  version === 1 ? legacyPresetSchema : presetSchema;

export const parsePreset = (value: unknown): Preset => {
  const result = presetSchema.safeParse(value);
  if (!result.success) throw new InvalidPresetError(describeIssues(result.error));

  return result.data;
};

export const isValidPreset = (value: unknown): value is Preset =>
  presetSchema.safeParse(value).success;
