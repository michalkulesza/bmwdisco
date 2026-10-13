import type { Effect } from '@/data/types';
import { phaseOf, type SessionPhase } from '@/domain/session/phase';
import type { RunInput } from '@/domain/session/types';
import { createRng } from '@/simulator/rng';
import { makeVehicle } from '@/test-utils/domain-sim';
import { createRig, DEMO_CONFIG, type SessionRig } from '@/test-utils/session-harness';

const ALLOWED_TRANSITIONS: Record<SessionPhase, readonly SessionPhase[]> = {
  idle: ['connecting'],
  connecting: ['identifying', 'error', 'idle'],
  identifying: ['ready', 'restoring', 'error', 'idle'],
  ready: ['running', 'restoring', 'reconnecting', 'disconnecting'],
  running: ['ready', 'restoring', 'reconnecting', 'disconnecting'],
  restoring: ['ready', 'reconnecting', 'disconnecting', 'error'],
  disconnecting: ['disconnected'],
  reconnecting: ['restoring', 'ready', 'error', 'disconnected'],
  disconnected: ['connecting'],
  error: ['connecting', 'disconnected'],
};

const ONLINE: readonly SessionPhase[] = ['ready', 'running', 'restoring'];
const CHASSIS = ['F20', 'F10', 'F15', 'F25'];
const ADVANCES_MS = [0, 5, 20, 80, 250, 700, 2500];
const TOGGLE_IDS = ['toggle.hazard', 'toggle.brakeForce', 'toggle.welcomeLight', 'toggle.nope'];
const WALKS = 250;
const STEPS_PER_WALK = 30;
const BATCH_SIZE = 25;

const preset = (id: string, steps: unknown[]): RunInput =>
  ({ id, name: id, color: 'blue', icon: 'Car', steps }) as unknown as RunInput;

const PRESETS: RunInput[] = [
  preset('quick', [
    { type: 'set', elements: ['lowBeamLeft'], state: 'on', durationMs: 50 },
    { type: 'set', elements: ['lowBeamLeft'], state: 'off' },
  ]),
  preset('hold', [
    { type: 'set', elements: ['lowBeamLeft', 'lowBeamRight', 'frontFogLeft'], state: 'on' },
    { type: 'wait', ms: 3000 },
    { type: 'set', elements: ['lowBeamLeft', 'lowBeamRight', 'frontFogLeft'], state: 'off' },
  ]),
  preset('limit', [
    { type: 'set', elements: ['highBeamLeft'], state: 'on' },
    { type: 'wait', ms: 60_000 },
    { type: 'wait', ms: 30_000 },
  ]),
  preset('broken', [{ type: 'wait', ms: 1 }]),
];

type Step = (rig: SessionRig, pick: (count: number) => number) => void | Promise<void>;

const oneShots = (rig: SessionRig): Effect[] =>
  (rig.context().car?.effects ?? []).filter((effect) => effect.kind === 'oneShot');

const ACTIONS: [string, number, Step][] = [
  ['connect', 3, (rig) => rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG })],
  ['cancel', 1, (rig) => rig.actor.send({ type: 'CANCEL' })],
  ['disconnect', 1, (rig) => rig.actor.send({ type: 'DISCONNECT' })],
  ['stop', 3, (rig) => rig.actor.send({ type: 'STOP' })],
  ['background', 2, (rig) => rig.appState.emit('background')],
  ['foreground', 2, (rig) => rig.appState.emit('active')],
  ['linkLost', 1, (rig) => rig.actor.send({ type: 'LINK_LOST' })],
  [
    'runPreset',
    6,
    (rig, pick) => rig.actor.send({ type: 'RUN', item: PRESETS[pick(PRESETS.length)]! }),
  ],
  [
    'runEffect',
    4,
    (rig, pick) => {
      const effects = oneShots(rig);
      if (effects.length === 0) return;

      rig.actor.send({ type: 'RUN', item: effects[pick(effects.length)]! });
    },
  ],
  [
    'toggle',
    5,
    (rig, pick) =>
      rig.actor.send({
        type: 'TOGGLE',
        effectId: TOGGLE_IDS[pick(TOGGLE_IDS.length)]!,
        on: pick(3) !== 0,
      }),
  ],
  ['dropLink', 2, async (rig) => void (await rig.context().link?.close())],
  ['adapterDown', 1, (rig) => void (rig.availability.linkAvailable = false)],
  ['adapterUp', 2, (rig) => void (rig.availability.linkAvailable = true)],
  [
    'nrc',
    2,
    (rig, pick) =>
      rig.vehicle.faults.configure({ conditionsNotCorrect: { requests: 1 + pick(3) } }),
  ],
  [
    'dropAfter',
    1,
    (rig, pick) => rig.vehicle.faults.configure({ dropAfterRequests: 3 + pick(12) }),
  ],
  ['clearFaults', 2, (rig) => rig.vehicle.faults.reset()],
];

const STOPPING_ACTIONS = ['stop', 'background'];
const STOP_SETTLE_MS = 3000;

const TOTAL_WEIGHT = ACTIONS.reduce((sum, [, weight]) => sum + weight, 0);

const pickAction = (roll: number) => {
  let remaining = roll * TOTAL_WEIGHT;
  for (const action of ACTIONS) {
    remaining -= action[1];
    if (remaining < 0) return action;
  }

  return ACTIONS[0]!;
};

const lit = (rig: SessionRig) => rig.vehicle.getLitElements().length;

const walk = async (seed: number): Promise<void> => {
  const rng = createRng(seed);
  const pick = (count: number) => Math.floor(rng() * count);
  const vehicle = makeVehicle(CHASSIS[seed % CHASSIS.length]!, {
    latency: (['enet', 'thor'] as const)[pick(2)],
  });
  const rig = createRig(vehicle);
  const trace: string[] = [];
  const fail = (message: string): never => {
    throw new Error(`seed ${seed} after [${trace.join(', ')}]: ${message}`);
  };

  const phases: SessionPhase[] = [phaseOf(rig.actor.getSnapshot())];
  rig.actor.subscribe((snapshot) => {
    const phase = phaseOf(snapshot);
    const previous = phases[phases.length - 1]!;
    if (phase === previous) return;

    phases.push(phase);
    if (!ALLOWED_TRANSITIONS[previous].includes(phase)) fail(`illegal ${previous} -> ${phase}`);
  });

  const handle = vehicle.handle.bind(vehicle);
  vehicle.handle = (ecu, request) => {
    const before = vehicle.getLitElements().length;
    const reply = handle(ecu, request);
    if (vehicle.getLitElements().length > before && rig.phase() !== 'running') {
      fail(`light turned on while ${rig.phase()}`);
    }

    return reply;
  };

  const checkSafe = () => {
    if (lit(rig) > 0 && !rig.context().lightsMayBeOn) {
      fail(`lights lit (${lit(rig)}) but lightsMayBeOn is false in ${rig.phase()}`);
    }
  };

  rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
  await jest.advanceTimersByTimeAsync(300);

  for (let step = 0; step < STEPS_PER_WALK; step++) {
    const [name, , apply] = pickAction(rng());
    trace.push(`${name}@${rig.phase()}`);
    await apply(rig, pick);
    checkSafe();
    await jest.advanceTimersByTimeAsync(ADVANCES_MS[pick(ADVANCES_MS.length)]!);
    checkSafe();

    if (STOPPING_ACTIONS.includes(name)) {
      await jest.advanceTimersByTimeAsync(STOP_SETTLE_MS);
      const { activeToggles } = rig.context();
      if (rig.phase() === 'ready' && (lit(rig) > 0 || activeToggles.length > 0)) {
        fail('still forcing lights after stop/background');
      }
    }
  }

  rig.availability.linkAvailable = true;
  vehicle.faults.reset();
  trace.push('settle');
  await jest.advanceTimersByTimeAsync(30_000);
  checkSafe();

  if (ONLINE.includes(rig.phase())) {
    trace.push('finalDisconnect');
    rig.actor.send({ type: 'DISCONNECT' });
    await jest.advanceTimersByTimeAsync(30_000);
    if (lit(rig) > 0) fail('lights still lit after a clean disconnect on a live link');
  } else if (rig.context().lightsMayBeOn || lit(rig) > 0) {
    trace.push('recover');
    rig.actor.send({ type: 'CONNECT', config: DEMO_CONFIG });
    await jest.advanceTimersByTimeAsync(30_000);
    if (rig.phase() !== 'ready') fail(`could not recover, phase ${rig.phase()}`);
    if (lit(rig) > 0 || rig.context().lightsMayBeOn) fail('recovery did not restore control');
  }
  checkSafe();

  rig.actor.stop();
  jest.clearAllTimers();
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('session machine random walks', () => {
  const batches = Array.from({ length: WALKS / BATCH_SIZE }, (_, index) => index * BATCH_SIZE + 1);

  it.each(batches)(
    'keeps the safety invariants and only takes legal transitions (seeds %i+)',
    async (first) => {
      for (let seed = first; seed < first + BATCH_SIZE; seed++) await walk(seed);
    },
    120_000,
  );
});
