import { PresetImportError } from '../errors';

import { PRESET_FILE_FORMAT, PRESET_FILE_VERSION, PRESET_LIMITS } from './limits';
import { describeIssues, importedPresetSchema, presetFileSchema } from './schema';

import type { Preset } from './types';

const utf8Length = (text: string): number => {
  let bytes = 0;

  for (const char of text) {
    const code = char.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }

  return bytes;
};

export const exportPresets = (presets: readonly Preset[]): string =>
  JSON.stringify({ format: PRESET_FILE_FORMAT, version: PRESET_FILE_VERSION, presets }, null, 2);

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    throw new PresetImportError('invalidJson');
  }
};

export const importPresets = (text: string): Preset[] => {
  if (utf8Length(text) > PRESET_LIMITS.maxFileBytes) throw new PresetImportError('tooLarge');

  const file = presetFileSchema.safeParse(parseJson(text));
  if (!file.success) {
    const tooMany = file.error.issues.some(
      (issue) => issue.code === 'too_big' && issue.path[0] === 'presets',
    );
    throw new PresetImportError(
      tooMany ? 'tooManyPresets' : 'invalidFormat',
      describeIssues(file.error),
    );
  }

  const schema = importedPresetSchema(file.data.version);
  const presets: Preset[] = [];
  const issues: string[] = [];

  file.data.presets.forEach((candidate, index) => {
    const result = schema.safeParse(candidate);
    if (result.success) presets.push(result.data);
    else issues.push(...describeIssues(result.error).map((issue) => `#${index + 1} ${issue}`));
  });
  if (issues.length > 0) throw new PresetImportError('invalidPreset', issues);

  const ids = new Set(presets.map((preset) => preset.id));
  if (ids.size !== presets.length) throw new PresetImportError('invalidPreset', ['duplicate id']);

  return presets;
};
