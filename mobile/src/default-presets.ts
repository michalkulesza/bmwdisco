import { ElementId, LightingPreset, PresetStep } from './presets';

const STROBE_MS = 50;
const STROBE_CYCLES = 15;

const flash = (element: ElementId): PresetStep[] => [
  { type: 'set', elements: [element], state: 'on' }, { type: 'wait', durationMs: STROBE_MS },
  { type: 'set', elements: [element], state: 'off' }, { type: 'wait', durationMs: STROBE_MS },
];

export const FOG_STROBE: LightingPreset = {
  id: 'default-fog-strobe', name: 'Fog Strobe',
  steps: Array.from({ length: STROBE_CYCLES }, () => [...flash('frontFogLeft'), ...flash('frontFogRight')]).flat(),
};

export const DEFAULT_PRESETS: readonly LightingPreset[] = [FOG_STROBE];

export const withDefaultPresets = (presets: LightingPreset[], limit: number): LightingPreset[] => {
  const missing = DEFAULT_PRESETS.filter(preset => !presets.some(existing => existing.id === preset.id));
  return [...presets, ...missing].slice(0, Math.max(presets.length, limit));
};
