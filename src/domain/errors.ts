export class UnsupportedVehicleError extends Error {
  constructor(public readonly respondedAddresses: readonly number[]) {
    super('No supported F-series light module identified');
    this.name = 'UnsupportedVehicleError';
  }
}

export class CarNotRespondingError extends Error {
  constructor() {
    super('The car did not answer any identification request');
    this.name = 'CarNotRespondingError';
  }
}

export class RunLimitError extends Error {
  constructor(limitMs: number) {
    super(`Run exceeded its ${limitMs} ms limit`);
    this.name = 'RunLimitError';
  }
}

export class NothingToRunError extends Error {
  constructor() {
    super('None of the requested elements exist on this car');
    this.name = 'NothingToRunError';
  }
}

export class InvalidPresetError extends Error {
  constructor(public readonly issues: readonly string[]) {
    super(`Invalid preset: ${issues.join('; ')}`);
    this.name = 'InvalidPresetError';
  }
}

export type PresetImportFailure =
  'tooLarge' | 'invalidJson' | 'invalidFormat' | 'tooManyPresets' | 'invalidPreset';

export class PresetImportError extends Error {
  constructor(
    public readonly code: PresetImportFailure,
    public readonly issues: readonly string[] = [],
  ) {
    super(`Preset import failed: ${code}`);
    this.name = 'PresetImportError';
  }
}
