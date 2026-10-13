import Storage from 'expo-sqlite/kv-store';

import { parsePreset, PRESET_LIMITS, type Preset } from '@/domain';

import { SEED_PRESETS, usePresetsStore } from './presets';

const makePreset = (id: string, name = id): Preset => ({
  id,
  name,
  color: 'blue',
  icon: 'Lightning',
  steps: [{ type: 'set', elements: ['highBeamAll'], state: 'on', durationMs: 100 }],
});

const state = () => usePresetsStore.getState();

describe('presets store', () => {
  beforeEach(() => {
    usePresetsStore.setState({ presets: [...SEED_PRESETS] });
  });

  it('seeds valid Double flash and Fog strobe presets', () => {
    expect(state().presets.map((preset) => preset.name)).toEqual(['Double flash', 'Fog strobe']);
    state().presets.forEach((preset) => expect(() => parsePreset(preset)).not.toThrow());
  });

  it('adds a valid preset', () => {
    const result = state().add(makePreset('mine'));

    expect(result.ok).toBe(true);
    expect(state().presets.map((preset) => preset.id)).toContain('mine');
  });

  it('rejects an invalid preset without changing the list', () => {
    const result = state().add({ ...makePreset('bad'), steps: [] });

    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
    expect(state().presets).toHaveLength(SEED_PRESETS.length);
  });

  it('rejects steps shorter than the minimum duration', () => {
    const tooShort = makePreset('quick');
    tooShort.steps = [{ type: 'wait', ms: PRESET_LIMITS.minStepMs - 1 }];

    expect(state().add(tooShort)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('refuses to exceed the preset limit', () => {
    const many = Array.from({ length: PRESET_LIMITS.maxPresets }, (_, index) =>
      makePreset(`p${index}`),
    );
    usePresetsStore.setState({ presets: many });

    expect(state().add(makePreset('extra'))).toMatchObject({ ok: false, reason: 'limit' });
  });

  it('updates an existing preset and reports unknown ones', () => {
    state().add(makePreset('mine', 'Before'));

    const updated = state().update(makePreset('mine', 'After'));
    const missing = state().update(makePreset('ghost'));

    expect(updated.ok).toBe(true);
    expect(state().presets.find((preset) => preset.id === 'mine')?.name).toBe('After');
    expect(missing).toMatchObject({ ok: false, reason: 'notFound' });
  });

  it('rejects an invalid update', () => {
    state().add(makePreset('mine'));

    expect(state().update({ ...makePreset('mine'), name: '   ' })).toMatchObject({
      ok: false,
      reason: 'invalid',
    });
  });

  it('removes a preset', () => {
    state().remove('seed-double-flash');

    expect(state().presets.map((preset) => preset.id)).toEqual(['seed-fog-strobe']);
  });

  it('duplicates a preset under a new id', () => {
    const result = state().duplicate('seed-double-flash', 'Double flash copy');

    expect(result.ok).toBe(true);
    const copy = state().presets.at(-1)!;
    expect(copy.name).toBe('Double flash copy');
    expect(copy.id).not.toBe('seed-double-flash');
    expect(copy.steps).toEqual(SEED_PRESETS[0]!.steps);
    expect(state().duplicate('missing', 'x')).toMatchObject({ ok: false, reason: 'notFound' });
  });

  it('imports presets and renames colliding ids', () => {
    const count = state().importMany([makePreset('seed-double-flash'), makePreset('fresh')]);

    expect(count).toBe(2);
    const ids = state().presets.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('fresh');
  });

  it('imports only as many presets as there is room for', () => {
    usePresetsStore.setState({
      presets: Array.from({ length: PRESET_LIMITS.maxPresets - 1 }, (_, index) =>
        makePreset(`p${index}`),
      ),
    });

    expect(state().importMany([makePreset('a'), makePreset('b')])).toBe(1);
  });

  it('persists to storage and restores only valid presets', async () => {
    state().add(makePreset('kept'));
    const raw = Storage.getItemSync('presets');
    expect(raw).toContain('kept');

    const stored = JSON.parse(raw!);
    stored.state.presets.push({ id: 'broken', name: '', color: 'x', icon: 'y', steps: [] });
    usePresetsStore.setState({ presets: [] });
    Storage.setItemSync('presets', JSON.stringify(stored));
    await usePresetsStore.persist.rehydrate();

    const ids = state().presets.map((preset) => preset.id);
    expect(ids).toContain('kept');
    expect(ids).not.toContain('broken');
  });
});
