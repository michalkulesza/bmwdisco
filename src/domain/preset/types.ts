import type { ElementId } from '@/data/elements';

export interface SetStep {
  type: 'set';
  elements: ElementId[];
  state: 'on' | 'off';
  durationMs?: number;
}

export interface WaitStep {
  type: 'wait';
  ms: number;
}

export type PresetStep = SetStep | WaitStep;

export interface Preset {
  id: string;
  name: string;
  color: string;
  icon: string;
  steps: PresetStep[];
}
