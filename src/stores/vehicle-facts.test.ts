import Storage from 'expo-sqlite/kv-store';

import {
  resolveEquipmentConflict,
  selectHeadlightType,
  useVehicleFactsStore,
} from './vehicle-facts';

const store = () => useVehicleFactsStore.getState();
const vin = 'WBA1234567G123456';

beforeEach(() => {
  Storage.removeItemSync('vehicle-facts');
  useVehicleFactsStore.setState({ byVin: {}, sessionProfiles: { demo: null, unbound: null } });
});

describe('vehicle facts store', () => {
  it('persists facts against a valid VIN and retrieves them for the same vehicle', () => {
    const car = { vin };
    store().recordReadyFacts(
      car,
      selectHeadlightType({ headlightType: 'unknown' }, 'halogen', 1),
      [],
    );

    expect(store().getProfile(car).facts.headlightType).toBe('halogen');
    expect(Storage.getItemSync('vehicle-facts')).toContain(vin);
  });

  it('keeps missing VIN facts session-only and never matches chassis-like identity', () => {
    store().recordReadyFacts({}, selectHeadlightType({ headlightType: 'unknown' }, 'xenon', 1), []);

    expect(store().getProfile({}).facts.headlightType).toBe('xenon');
    expect(Storage.getItemSync('vehicle-facts')).toContain('"byVin":{}');
    expect(store().getProfile({ vin: 'WBA9876543G123456' }).facts.headlightType).toBe('unknown');
  });

  it('isolates Demo facts from persisted vehicle profiles', () => {
    store().recordReadyFacts(
      { vin },
      selectHeadlightType({ headlightType: 'unknown' }, 'led', 1),
      [],
      true,
    );

    expect(store().getProfile({ vin }, true).facts.headlightType).toBe('led');
    expect(store().getProfile({ vin }).facts.headlightType).toBe('unknown');
    expect(store().getProfile({}).facts.headlightType).toBe('unknown');
    expect(Storage.getItemSync('vehicle-facts')).toContain('"byVin":{}');
  });

  it('records conflicting assertions without dropping the user choice', () => {
    store().recordReadyFacts(
      { vin },
      {
        headlightType: 'xenon',
        source: 'factoryOrder',
        assertions: [{ value: 'xenon', source: 'factoryOrder', at: 1 }],
      },
      [],
    );
    const facts = selectHeadlightType(store().getProfile({ vin }).facts, 'halogen', 2);

    expect(facts.headlightType).toBe('halogen');
    expect(facts.conflict).toBe(true);
    expect(facts.assertions).toHaveLength(2);
  });

  it('requires explicit conflict resolution and keeps its history without validating any lamp', () => {
    const initial = { headlightType: 'xenon' as const, source: 'factoryOrder' as const };
    const conflicted = selectHeadlightType(initial, 'halogen', 2);
    expect(conflicted.conflict).toBe(true);
    const resolved = resolveEquipmentConflict(conflicted, 3);
    expect(resolved.conflict).toBe(false);
    expect(resolved.assertions).toHaveLength(3);
    expect(selectHeadlightType(resolved, 'halogen', 4).conflict).toBe(false);
    expect(selectHeadlightType(resolved, 'xenon', 4).conflict).toBe(true);
    store().recordReadyFacts({ vin }, resolved, []);
    expect(store().getProfile({ vin }).validations).toEqual([]);
  });

  it('drops malformed persisted profiles and vehicle bindings', async () => {
    Storage.setItemSync(
      'vehicle-facts',
      JSON.stringify({
        state: {
          byVin: {
            [vin]: { facts: { headlightType: 'halogen' }, validations: [] },
            short: { facts: { headlightType: 'led' }, validations: [] },
            WBA9876543G123456: {
              facts: { headlightType: 'halogen', vehicleBinding: 'session' },
              validations: [],
            },
            WBA7777777G123456: {
              facts: { headlightType: 'xenon' },
              validations: [{ mappingId: 2 }],
            },
          },
        },
        version: 1,
      }),
    );
    await useVehicleFactsStore.persist.rehydrate();

    expect(store().getProfile({ vin }).facts.headlightType).toBe('halogen');
    expect(store().getProfile({ vin: 'WBA9876543G123456' }).facts.headlightType).toBe('unknown');
    expect(store().getProfile({ vin: 'WBA7777777G123456' }).facts.headlightType).toBe('unknown');
  });
});
