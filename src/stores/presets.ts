import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { describeIssues, isValidPreset, presetSchema, PRESET_LIMITS, type Preset } from '@/domain';

import { kvStorage } from './kv-storage';

export type PresetSaveResult =
  | { ok: true; preset: Preset }
  | { ok: false; reason: 'invalid' | 'limit' | 'notFound'; issues: string[] };

export const SEED_PRESETS: readonly Preset[] = [
  {
    id: 'seed-double-flash',
    name: 'Double flash',
    color: 'rose',
    icon: 'Lightning',
    steps: [
      { type: 'set', elements: ['highBeamAll'], state: 'on', durationMs: 100 },
      { type: 'set', elements: ['highBeamAll'], state: 'off', durationMs: 100 },
      { type: 'set', elements: ['highBeamAll'], state: 'on', durationMs: 100 },
      { type: 'set', elements: ['highBeamAll'], state: 'off' },
    ],
  },
  {
    id: 'seed-fog-strobe',
    name: 'Fog strobe',
    color: 'teal',
    icon: 'CloudFog',
    steps: [
      { type: 'set', elements: ['frontFogBoth'], state: 'on', durationMs: 80 },
      { type: 'set', elements: ['frontFogBoth'], state: 'off', durationMs: 80 },
      { type: 'set', elements: ['frontFogBoth'], state: 'on', durationMs: 80 },
      { type: 'set', elements: ['frontFogBoth'], state: 'off', durationMs: 80 },
      { type: 'set', elements: ['frontFogBoth'], state: 'on', durationMs: 80 },
      { type: 'set', elements: ['frontFogBoth'], state: 'off' },
    ],
  },
];

export const createPresetId = () =>
  `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const validate = (candidate: unknown): PresetSaveResult => {
  const result = presetSchema.safeParse(candidate);
  if (result.success) return { ok: true, preset: result.data };

  return { ok: false, reason: 'invalid', issues: describeIssues(result.error) };
};

interface PresetsState {
  presets: Preset[];
  add: (preset: Preset) => PresetSaveResult;
  update: (preset: Preset) => PresetSaveResult;
  remove: (id: string) => void;
  duplicate: (id: string, name: string) => PresetSaveResult;
  importMany: (incoming: readonly Preset[]) => number;
}

export const usePresetsStore = create<PresetsState>()(
  persist(
    (set, get) => ({
      presets: [...SEED_PRESETS],

      add: (preset) => {
        if (get().presets.length >= PRESET_LIMITS.maxPresets) {
          return { ok: false, reason: 'limit', issues: [] };
        }

        const result = validate(preset);
        if (result.ok) set((state) => ({ presets: [...state.presets, result.preset] }));

        return result;
      },

      update: (preset) => {
        if (!get().presets.some((existing) => existing.id === preset.id)) {
          return { ok: false, reason: 'notFound', issues: [] };
        }

        const result = validate(preset);
        if (result.ok) {
          set((state) => ({
            presets: state.presets.map((existing) =>
              existing.id === preset.id ? result.preset : existing,
            ),
          }));
        }

        return result;
      },

      remove: (id) => set((state) => ({ presets: state.presets.filter((p) => p.id !== id) })),

      duplicate: (id, name) => {
        const source = get().presets.find((preset) => preset.id === id);
        if (!source) return { ok: false, reason: 'notFound', issues: [] };

        return get().add({ ...source, id: createPresetId(), name });
      },

      importMany: (incoming) => {
        const taken = new Set(get().presets.map((preset) => preset.id));
        const room = Math.max(PRESET_LIMITS.maxPresets - get().presets.length, 0);
        const accepted = incoming.slice(0, room).map((preset) => ({
          ...preset,
          id: taken.has(preset.id) ? createPresetId() : preset.id,
        }));
        set((state) => ({ presets: [...state.presets, ...accepted] }));

        return accepted.length;
      },
    }),
    {
      name: 'presets',
      version: 1,
      storage: kvStorage,
      partialize: ({ presets }) => ({ presets }),
      merge: (persisted, current) => {
        const stored = (persisted as Partial<PresetsState> | undefined)?.presets;
        if (!Array.isArray(stored)) return current;

        return { ...current, presets: stored.filter(isValidPreset) };
      },
    },
  ),
);
