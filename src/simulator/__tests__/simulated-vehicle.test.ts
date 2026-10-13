import { IDENTIFICATION, loadModule, MODULE_SGBDS } from '@/data/generated';
import type { ElementId } from '@/data/types';
import { fromHex } from '@/protocol/bytes';
import { matchUdsResponse } from '@/protocol/uds';

import { createProfile, defaultModulesFor, knownChassis, withoutLedHeadlights } from '../profiles';
import { SimulatedVehicle } from '../simulated-vehicle';
import { makeVin } from '../vin';

const ENTER_EXTENDED = fromHex('10 03');
const FEM = 0x40;
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const LETTER_VALUES: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
};

const vehicleWith = (sgbd: (typeof MODULE_SGBDS)[number]) =>
  new SimulatedVehicle({ profile: { chassis: 'F20', modules: [sgbd] } });

const extended = (vehicle: SimulatedVehicle, ecu: number) => {
  vehicle.handle(ecu, ENTER_EXTENDED);

  return vehicle;
};

describe('profiles', () => {
  it.each([
    ['F20', ['FEM_20', 'REM_20', 'FLE02_L', 'FLE02_R', 'KOMB25']],
    ['F32', ['FEM_20', 'REM_20', 'FLE02_L', 'FLE02_R', 'KOMB25']],
    ['F80', ['FEM_20', 'REM_20', 'FLE02_L', 'FLE02_R', 'KOMB25']],
    ['F10', ['FRM3', 'KOMB01', 'LHM2_L', 'LHM2_R']],
    ['F01', ['FRM3', 'KOMB01', 'LHM2_L', 'LHM2_R']],
    ['F15', ['BDC', 'KOMB01']],
    ['F48', ['BDC', 'KOMB25']],
  ])('uses the default module set for %s', (chassis, modules) => {
    expect(defaultModulesFor(chassis)).toEqual(modules);
  });

  it('rejects chassis that are not in the vehicle table', () => {
    expect(() => createProfile('G20')).toThrow(RangeError);
    expect(() => new SimulatedVehicle({ profile: 'E90' })).toThrow(RangeError);
  });

  it('accepts an explicit module list', () => {
    expect(createProfile('F20', ['BDC']).modules).toEqual(['BDC']);
  });
});

describe('identification', () => {
  it.each(knownChassis())('answers 22 F1 50 for every module of %s', (chassis) => {
    const vehicle = new SimulatedVehicle({ profile: chassis });

    for (const sgbd of vehicle.profile.modules) {
      const module = loadModule(sgbd);
      const response = vehicle.handle(module.address, fromHex('22 F1 50'))!;
      const sgbdHex = Array.from(response.subarray(3), (byte) =>
        byte.toString(16).padStart(2, '0').toUpperCase(),
      ).join('');

      expect(Array.from(response.subarray(0, 3))).toEqual([0x62, 0xf1, 0x50]);
      expect(IDENTIFICATION).toContainEqual(
        expect.objectContaining({ adrIndex: module.address, sgbdHex, sgbd }),
      );
    }
  });

  it('prefers the identity entry matching the chassis', () => {
    const vehicle = new SimulatedVehicle({ profile: { chassis: 'F80', modules: ['KOMB25'] } });
    const module = loadModule('KOMB25');
    const expected = module.identity.find((entry) => entry.chassis === 'F80')!.response;

    expect(Array.from(vehicle.handle(module.address, fromHex('22 F1 50'))!)).toEqual(expected);
  });

  it('answers 22 F1 90 with a deterministic valid VIN', () => {
    const vehicle = new SimulatedVehicle({ profile: 'F32' });
    const response = vehicle.handle(FEM, fromHex('22 F1 90'))!;
    const vin = String.fromCharCode(...response.subarray(3));

    expect(Array.from(response.subarray(0, 3))).toEqual([0x62, 0xf1, 0x90]);
    expect(vin).toBe(vehicle.vin);
    expect(vin).toMatch(/^[A-HJ-NPR-Z0-9]{17}$/);
    expect(makeVin('F32')).toBe(vin);
    expect(makeVin('F10')).not.toBe(vin);
  });

  it('computes the VIN check digit', () => {
    for (const chassis of knownChassis()) {
      const vin = makeVin(chassis);
      const sum = Array.from(vin).reduce(
        (total, char, index) => total + (LETTER_VALUES[char] ?? Number(char)) * WEIGHTS[index]!,
        0,
      );

      expect(vin[8]).toBe(sum % 11 === 10 ? 'X' : String(sum % 11));
    }
  });

  it('rejects malformed and unknown reads', () => {
    const vehicle = new SimulatedVehicle({ profile: 'F20' });

    expect(vehicle.handle(FEM, fromHex('22 F1'))).toEqual(fromHex('7F 22 13'));
    expect(vehicle.handle(FEM, fromHex('22 12 34'))).toEqual(fromHex('7F 22 31'));
  });
});

describe('sessions and error codes', () => {
  it('answers session control per ECU and rejects other sub-functions', () => {
    const vehicle = new SimulatedVehicle({ profile: 'F20' });

    expect(vehicle.handle(FEM, fromHex('10 03'))).toEqual(fromHex('50 03 00 32 01 F4'));
    expect(vehicle.handle(FEM, fromHex('10 01'))).toEqual(fromHex('50 01 00 32 01 F4'));
    expect(vehicle.handle(FEM, fromHex('10 02'))).toEqual(fromHex('7F 10 12'));
    expect(vehicle.handle(FEM, fromHex('10'))).toEqual(fromHex('7F 10 13'));
  });

  it('requires the extended session for IO control with NRC 0x7F', () => {
    const vehicle = new SimulatedVehicle({ profile: 'F20' });
    const on = fromHex('2F 45 01 03 01 01');

    expect(vehicle.handle(FEM, on)).toEqual(fromHex('7F 2F 7F'));
    expect(vehicle.getLitElements()).toEqual([]);

    vehicle.handle(FEM, ENTER_EXTENDED);

    expect(vehicle.handle(FEM, on)).toEqual(fromHex('6F 45 01 03 01'));
  });

  it('tracks the session per ECU', () => {
    const vehicle = new SimulatedVehicle({ profile: 'F20' });
    vehicle.handle(FEM, ENTER_EXTENDED);

    expect(vehicle.handle(0x60, fromHex('31 01 F0 12 01 FC 21'))).toEqual(fromHex('7F 31 7F'));
  });

  it('uses NRC 0x31 for unknown payloads of known services and 0x11 for unknown services', () => {
    const vehicle = extended(new SimulatedVehicle({ profile: 'F20' }), FEM);

    expect(vehicle.handle(FEM, fromHex('2F 45 01 03 7E 01'))).toEqual(fromHex('7F 2F 31'));
    expect(vehicle.handle(FEM, fromHex('19 02 FF'))).toEqual(fromHex('7F 19 11'));
  });

  it('does not answer unknown ECUs or empty requests', () => {
    const vehicle = new SimulatedVehicle({ profile: 'F20' });

    expect(vehicle.handle(0x7a, fromHex('22 F1 50'))).toBeNull();
    expect(vehicle.handle(FEM, new Uint8Array())).toBeNull();
  });

  it('answers tester present and suppresses the positive response on request', () => {
    const vehicle = new SimulatedVehicle({ profile: 'F20' });

    expect(vehicle.handle(FEM, fromHex('3E 00'))).toEqual(fromHex('7E 00'));
    expect(vehicle.handle(FEM, fromHex('3E 80'))).toBeNull();
    expect(vehicle.handle(FEM, fromHex('3E FF'))).toEqual(fromHex('7E 7F'));
    expect(vehicle.handle(FEM, fromHex('3E'))).toEqual(fromHex('7F 3E 13'));
  });
});

describe.each(MODULE_SGBDS)('%s elements', (sgbd) => {
  const module = loadModule(sgbd);
  const elements = Object.entries(module.elements) as [
    ElementId,
    NonNullable<(typeof module.elements)[ElementId]>,
  ][];

  it('round-trips every element on/off with a positive response and lit state', () => {
    const vehicle = extended(vehicleWith(sgbd), module.address);

    for (const [id, commands] of elements) {
      const on = Uint8Array.from(commands.on);
      const onResponse = vehicle.handle(module.address, on)!;

      expect(matchUdsResponse(on, onResponse).kind).toBe('positive');
      expect(
        Array.from(onResponse.subarray(0, commands.expectedResponsePrefix?.length ?? 0)),
      ).toEqual(commands.expectedResponsePrefix ? [...commands.expectedResponsePrefix] : []);
      expect(vehicle.getLitElements()).toContainEqual({ sgbd, element: id });

      const off = Uint8Array.from(commands.off);

      expect(matchUdsResponse(off, vehicle.handle(module.address, off)!).kind).toBe('positive');
      expect(vehicle.getLitElements()).not.toContainEqual({ sgbd, element: id });
    }

    expect(vehicle.getLitElements()).toEqual([]);
  });

  it('accepts every named command with a non-negative response', () => {
    const vehicle = vehicleWith(sgbd);

    for (const command of Object.values(module.commands)) {
      vehicle.handle(module.address, ENTER_EXTENDED);
      const payload = Uint8Array.from(command);
      const response = vehicle.handle(module.address, payload);

      if (response) expect(response[0]).not.toBe(0x7f);
    }
  });

  it('clears forced state on return control and on leaving the extended session', () => {
    const vehicle = extended(vehicleWith(sgbd), module.address);
    for (const [, commands] of elements.slice(0, 3)) {
      vehicle.handle(module.address, Uint8Array.from(commands.on));
    }
    const litBefore = vehicle.getLitElements().length;

    for (const command of module.returnControl) {
      const payload = Uint8Array.from(command);

      expect(matchUdsResponse(payload, vehicle.handle(module.address, payload)!).kind).toBe(
        'positive',
      );
      expect(vehicle.getLitElements()).toEqual([]);
    }

    if (litBefore === 0) return;

    const first = elements[0]![1];
    vehicle.handle(module.address, Uint8Array.from(first.on));
    vehicle.handle(module.address, fromHex('10 01'));

    expect(vehicle.getLitElements()).toEqual([]);
  });
});

describe('observability', () => {
  it('notifies listeners only when the lit set changes', () => {
    const vehicle = extended(new SimulatedVehicle({ profile: withoutLedHeadlights('F20') }), FEM);
    const listener = jest.fn();
    const unsubscribe = vehicle.onStateChange(listener);
    const on = Uint8Array.from(loadModule('FEM_20').elements.lowBeamLeft!.on);
    const off = Uint8Array.from(loadModule('FEM_20').elements.lowBeamLeft!.off);

    vehicle.handle(FEM, on);
    vehicle.handle(FEM, on);
    vehicle.handle(FEM, off);
    vehicle.handle(FEM, off);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, [{ sgbd: 'FEM_20', element: 'lowBeamLeft' }]);
    expect(listener).toHaveBeenNthCalledWith(2, []);

    unsubscribe();
    vehicle.handle(FEM, on);

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('logs requests with their responses and caps the log', () => {
    const vehicle = new SimulatedVehicle({ profile: 'F20' });
    vehicle.handle(FEM, fromHex('22 F1 50'));
    vehicle.handle(0x7a, fromHex('22 F1 50'));

    expect(vehicle.requestLog).toHaveLength(2);
    expect(vehicle.requestLog[0]).toMatchObject({
      ecu: FEM,
      response: fromHex('62 F1 50 0F 16 B0'),
    });
    expect(vehicle.requestLog[1]!.response).toBeNull();

    for (let index = 0; index < 1100; index++) vehicle.handle(FEM, fromHex('3E 00'));

    expect(vehicle.requestLog).toHaveLength(1000);

    vehicle.clearLog();

    expect(vehicle.requestLog).toEqual([]);
  });
});

describe('outputs that reply positively but drive nothing (F32 car test)', () => {
  const femCommand = (element: ElementId, state: 'on' | 'off' = 'on') =>
    Uint8Array.from(loadModule('FEM_20').elements[element]![state]);
  const press = (vehicle: SimulatedVehicle, element: ElementId) =>
    vehicle.handle(FEM, femCommand(element));

  it.each([
    'lowBeamLeft',
    'lowBeamRight',
    'highBeamLeft',
    'highBeamRight',
    'daytimeLeft',
    'daytimeRight',
    'brakeAll',
  ] as const)('FEM %s is accepted but stays dark on the default F32', (element) => {
    const vehicle = extended(new SimulatedVehicle({ profile: 'F32' }), FEM);

    const response = press(vehicle, element)!;

    expect(matchUdsResponse(femCommand(element), response).kind).toBe('positive');
    expect(vehicle.getLitElements()).toEqual([]);
  });

  it('keeps the wired FEM outputs working next to the dead ones', () => {
    const vehicle = extended(new SimulatedVehicle({ profile: 'F32' }), FEM);

    press(vehicle, 'frontFogLeft');

    expect(vehicle.getLitElements()).toEqual([{ sgbd: 'FEM_20', element: 'frontFogLeft' }]);
  });

  it('lights the per-side headlights on a car without FLE02', () => {
    const vehicle = extended(new SimulatedVehicle({ profile: withoutLedHeadlights('F32') }), FEM);

    press(vehicle, 'lowBeamLeft');

    expect(vehicle.getLitElements()).toEqual([{ sgbd: 'FEM_20', element: 'lowBeamLeft' }]);
  });

  it('lights the FEM brake function when REM_20 is absent', () => {
    const vehicle = extended(
      new SimulatedVehicle({ profile: { chassis: 'F32', modules: ['FEM_20'] } }),
      FEM,
    );

    press(vehicle, 'brakeAll');

    expect(vehicle.getLitElements()).toEqual([{ sgbd: 'FEM_20', element: 'brakeAll' }]);
  });
});
