export const LIGHT_ELEMENTS = [
  { id: 'frontLeftIndicator', label: 'Front left indicator', side: 'left' },
  { id: 'frontRightIndicator', label: 'Front right indicator', side: 'right' },
] as const;
export type ElementId = typeof LIGHT_ELEMENTS[number]['id'];
export type PresetStep = { type: 'set'; elements: ElementId[]; state: 'on' | 'off' }
  | { type: 'wait'; durationMs: number };
export interface LightingPreset { id: string; name: string; steps: PresetStep[] }
export const PRESET_LIMITS = { presets: 100, steps: 200, waitMs: 2000, totalWaitMs: 60000, fileBytes: 1024 * 1024 };

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: expected an object`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[], path: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${path}: unknown field "${key}"`);
}
export function validatePreset(value: unknown, path = 'Preset'): LightingPreset {
  const preset = object(value, path);
  keys(preset, ['id', 'name', 'steps'], path);
  if (typeof preset.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(preset.id)) throw new Error(`${path}: invalid id`);
  if (typeof preset.name !== 'string' || !preset.name.trim() || preset.name.trim().length > 80) throw new Error(`${path}: name must be 1–80 characters`);
  if (!Array.isArray(preset.steps) || !preset.steps.length || preset.steps.length > PRESET_LIMITS.steps) throw new Error(`${path}: use 1–${PRESET_LIMITS.steps} blocks`);
  let totalWait = 0;
  const steps: PresetStep[] = preset.steps.map((value, index) => {
    const location = `${path}, block ${index + 1}`;
    const step = object(value, location);
    if (step.type === 'wait') {
      keys(step, ['type', 'durationMs'], location);
      if (typeof step.durationMs !== 'number' || !Number.isInteger(step.durationMs) || step.durationMs < 50 || step.durationMs > PRESET_LIMITS.waitMs) throw new Error(`${location}: delay must be 50–${PRESET_LIMITS.waitMs} ms`);
      totalWait += step.durationMs;
      return { type: 'wait', durationMs: step.durationMs };
    }
    if (step.type !== 'set') throw new Error(`${location}: unsupported block type`);
    keys(step, ['type', 'element', 'elements', 'state'], location);
    if ('element' in step && 'elements' in step) throw new Error(`${location}: use element or elements, not both`);
    const elements = 'element' in step ? [step.element] : step.elements;
    if (!Array.isArray(elements) || !elements.length || elements.length > LIGHT_ELEMENTS.length
      || new Set(elements).size !== elements.length
      || elements.some(id => !LIGHT_ELEMENTS.some(light => light.id === id))) throw new Error(`${location}: select supported, unique light elements`);
    if (step.state !== 'on' && step.state !== 'off') throw new Error(`${location}: state must be on or off`);
    return { type: 'set', elements: [...elements] as ElementId[], state: step.state };
  });
  if (!steps.some(step => step.type === 'set')) throw new Error(`${path}: add at least one light block`);
  if (totalWait > PRESET_LIMITS.totalWaitMs) throw new Error(`${path}: total delays cannot exceed 60 seconds`);
  return { id: preset.id, name: preset.name.trim(), steps };
}
export function parsePresets(json: string): LightingPreset[] {
  if (json.length > PRESET_LIMITS.fileBytes) throw new Error('Preset file is too large (maximum 1 MB)');
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error('Invalid JSON: check commas, quotes, and brackets'); }
  const file = object(value, 'File');
  keys(file, ['schemaVersion', 'presets'], 'File');
  if (file.schemaVersion !== 1) throw new Error('Unsupported schemaVersion; expected 1');
  if (!Array.isArray(file.presets) || file.presets.length > PRESET_LIMITS.presets) throw new Error('File must contain a presets array with at most 100 presets');
  const presets = file.presets.map((preset, i) => validatePreset(preset, `Preset ${i + 1}`));
  if (new Set(presets.map(preset => preset.id)).size !== presets.length) throw new Error('File contains duplicate preset IDs');
  return presets;
}
export function serializePresets(presets: LightingPreset[]): string {
  return JSON.stringify({ schemaVersion: 1, presets: parsePresets(JSON.stringify({ schemaVersion: 1, presets })) }, null, 2);
}
export function newPresetId() { return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
export function mergePresets(existing: LightingPreset[], incoming: LightingPreset[]): LightingPreset[] {
  const ids = new Set(existing.map(preset => preset.id));
  const added = incoming.map(preset => {
    let id = preset.id;
    while (ids.has(id)) id = newPresetId();
    ids.add(id);
    return { ...preset, id, name: id === preset.id ? preset.name : `${preset.name.slice(0, 69)} (imported)` };
  });
  return parsePresets(serializePresets([...existing, ...added]));
}
