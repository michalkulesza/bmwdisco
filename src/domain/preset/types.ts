import type { ElementId } from '@/data/elements';
import type { LogicalActionId } from '@/domain/actions/catalog';

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

export interface ActionStep {
  type: 'action';
  actions: LogicalActionId[];
  state: 'on' | 'off';
  durationMs?: number;
}

export type PresetStep = SetStep | ActionStep | WaitStep;

export type PresetPlayback = 'once' | 'loop' | 'hold';

export interface Preset {
  id: string;
  name: string;
  color: string;
  icon: string;
  steps: PresetStep[];
  playback?: PresetPlayback;
}
