import { create } from 'zustand';

import { type Preset } from '@/domain';

import { stripKeys, toEditorSteps, type EditorStep } from './helpers';

export interface DraftSnapshot {
  name: string;
  color: string;
  icon: string;
  steps: EditorStep[];
}

const EMPTY_DRAFT: DraftSnapshot = { name: '', color: 'blue', icon: 'Lightning', steps: [] };

const serialize = ({ name, color, icon, steps }: DraftSnapshot): string =>
  JSON.stringify({ name, color, icon, steps: stripKeys(steps) });

interface DraftState extends DraftSnapshot {
  baseline: string;
  sourceId: string | null;
  load: (preset: Preset | undefined, sourceId: string) => void;
  reset: () => void;
  setName: (name: string) => void;
  setColor: (color: string) => void;
  setIcon: (icon: string) => void;
  setSteps: (steps: EditorStep[]) => void;
  addStep: (step: EditorStep) => void;
  updateStep: (key: string, step: EditorStep) => void;
  removeStep: (key: string) => void;
}

export const useDraftStore = create<DraftState>()((set) => ({
  ...EMPTY_DRAFT,
  baseline: serialize(EMPTY_DRAFT),
  sourceId: null,

  reset: () => set({ ...EMPTY_DRAFT, baseline: serialize(EMPTY_DRAFT), sourceId: null }),

  load: (preset, sourceId) => {
    const snapshot: DraftSnapshot = preset
      ? {
          name: preset.name,
          color: preset.color,
          icon: preset.icon,
          steps: toEditorSteps(preset.steps),
        }
      : EMPTY_DRAFT;
    set({ ...snapshot, baseline: serialize(snapshot), sourceId });
  },

  setName: (name) => set({ name }),
  setColor: (color) => set({ color }),
  setIcon: (icon) => set({ icon }),
  setSteps: (steps) => set({ steps }),
  addStep: (step) => set((state) => ({ steps: [...state.steps, step] })),
  updateStep: (key, step) =>
    set((state) => ({
      steps: state.steps.map((existing) => (existing.key === key ? step : existing)),
    })),
  removeStep: (key) => set((state) => ({ steps: state.steps.filter((step) => step.key !== key) })),
}));

export const isDraftDirty = (state: DraftState): boolean => serialize(state) !== state.baseline;
