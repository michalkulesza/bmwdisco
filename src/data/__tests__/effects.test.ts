import { loadEffects, loadModule, MODULE_SGBDS } from '../generated';
import i18nKeys from '../generated/i18n-keys.json';

describe('effects', () => {
  const effects = loadEffects();
  const modules = MODULE_SGBDS.map(loadModule);

  it('resolves every step on at least one module', () => {
    for (const effect of effects) {
      for (const step of [...effect.steps, ...(effect.offSteps ?? [])]) {
        expect({
          effect: effect.id,
          element: step.element,
          found: modules.some((m) => m.elements[step.element]),
        }).toEqual({
          effect: effect.id,
          element: step.element,
          found: true,
        });
      }
    }
  });

  it('lists exactly the modules that provide a step element', () => {
    for (const effect of effects) {
      const steps = [...effect.steps, ...(effect.offSteps ?? [])];
      const expected = modules
        .filter((module) => steps.some((step) => module.elements[step.element]))
        .map((module) => module.sgbd)
        .sort();

      expect(effect.requiredModules).toEqual(expected);
      expect(expected.length).toBeGreaterThan(0);
    }
  });

  it('has unique ids and translation keys that are exported for M6', () => {
    const ids = effects.map((effect) => effect.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(i18nKeys.effects).toEqual(effects.map((effect) => effect.nameKey).sort());
  });

  it('only pairs toggles with off steps', () => {
    for (const effect of effects) {
      expect(effect.kind === 'toggle').toBe(effect.offSteps !== undefined);
      expect(effect.steps.length).toBeGreaterThan(0);
    }
  });

  it('keeps known-good and drops unresolvable actions', () => {
    const ids = effects.map((effect) => effect.id);

    expect(ids).toContain('flash.lowBeamLeft');
    expect(ids).toContain('toggle.hazard');
    expect(ids).not.toContain('flash.bixenonLeft');
    expect(ids.some((id) => id.startsWith('taillight_flash.'))).toBe(false);
    expect(ids).not.toContain('toggle.followMeHome');
  });

  it('encodes a flash as on then off for the same element', () => {
    const flash = effects.find((effect) => effect.id === 'flash.lowBeamLeft');

    expect(flash?.steps).toEqual([
      { element: 'lowBeamLeft', on: true },
      { element: 'lowBeamLeft', on: false },
    ]);
    expect(flash?.kind).toBe('oneShot');
  });

  it('flags headlight LED effects as needing silenced communication', () => {
    const show = effects.find((effect) => effect.id === 'headlight_show.runwaySweep');

    expect(show?.silenceCommunication).toBe(true);
    expect(show?.clusterFeedback).toBe(true);
  });
});
