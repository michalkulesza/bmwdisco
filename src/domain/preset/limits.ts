export const PRESET_LIMITS = {
  maxPresets: 100,
  maxSteps: 200,
  minStepMs: 50,
  maxTotalMs: 90_000,
  maxFileBytes: 1024 * 1024,
  maxNameLength: 40,
  maxElementsPerStep: 64,
} as const;

export const MAX_RUN_MS = PRESET_LIMITS.maxTotalMs;

// Pack actions carry no timing, so effects play one step per tick; the runner stretches it to the adapter RTT.
export const EFFECT_TICK_MS = 100;

// A preset cannot hold state, so a duplicated toggle becomes on, hold, off.
export const TOGGLE_PRESET_HOLD_MS = 1000;

export const PRESET_FILE_FORMAT = 'bimmerdisco.presets';

export const PRESET_FILE_VERSION = 1;
