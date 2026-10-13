import { loadEffects } from '@/data/generated';
import type { DiagnosticLink } from '@/link/types';
import { fromHex } from '@/protocol/bytes';
import { abortReason } from '@/protocol/errors';

import { CarNotRespondingError, UnsupportedVehicleError } from '../errors';

import {
  buildElementSources,
  isEffectAvailable,
  matchIdentity,
  parseVin,
  probeAddresses,
  rankChassis,
  selectableElementsOf,
  toDetectedModule,
} from './helpers';

import type { DetectedCar, DetectedModule, DetectOptions, LinkProvider } from './types';

export const DEFAULT_PROBE_TIMEOUT_MS = 700;

const IDENTITY_REQUEST = fromHex('22 F1 50');
const VIN_REQUEST = fromHex('22 F1 90');

const ensureOpen = async (provider: LinkProvider): Promise<DiagnosticLink> =>
  provider.link.state === 'open' ? provider.link : provider.reopen();

const readVin = async (
  provider: LinkProvider,
  module: DetectedModule,
  timeoutMs: number,
): Promise<string | undefined> => {
  try {
    const link = await ensureOpen(provider);
    const response = await link.request(module.address, VIN_REQUEST, {
      timeoutMs,
      totalMs: timeoutMs,
    });

    return parseVin(response);
  } catch {
    return undefined;
  }
};

export const detectCar = async (
  provider: LinkProvider,
  options: DetectOptions = {},
): Promise<DetectedCar> => {
  const {
    addresses = probeAddresses(),
    probeTimeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
    signal,
  } = options;
  const modules: DetectedModule[] = [];
  const responded: number[] = [];

  for (const address of addresses) {
    if (signal?.aborted) throw abortReason(signal);

    const link = await ensureOpen(provider);
    let response: Uint8Array;
    try {
      response = await link.request(address, IDENTITY_REQUEST, {
        timeoutMs: probeTimeoutMs,
        totalMs: probeTimeoutMs,
        probe: true,
        signal,
      });
    } catch {
      if (signal?.aborted) throw abortReason(signal);
      continue;
    }

    responded.push(address);
    const entry = matchIdentity(address, response);
    if (entry) modules.push(toDetectedModule(entry));
  }

  if (responded.length === 0) throw new CarNotRespondingError();

  const elementSources = buildElementSources(modules);
  const selectableElements = selectableElementsOf(elementSources);
  if (selectableElements.length === 0) throw new UnsupportedVehicleError(responded);

  const vin = await readVin(provider, modules[0]!, probeTimeoutMs);
  await ensureOpen(provider);

  const chassisCandidates = rankChassis(modules);
  const effects = loadEffects().filter((effect) =>
    isEffectAvailable(effect, modules, elementSources),
  );

  return {
    vin,
    chassis: chassisCandidates[0],
    chassisCandidates,
    modules,
    elementSources,
    selectableElements,
    effects,
  };
};

export const createLinkProvider = (
  initial: DiagnosticLink,
  reopen: () => Promise<DiagnosticLink>,
): LinkProvider => {
  const state = { link: initial };

  return {
    get link() {
      return state.link;
    },
    reopen: async () => {
      await state.link.close();
      state.link = await reopen();

      return state.link;
    },
  };
};

export const ModuleRegistry = { detect: detectCar, probeAddresses } as const;
