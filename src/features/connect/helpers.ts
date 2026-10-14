import { loadVehicles } from '@/data/generated';
import type { AdapterConfig, AdapterId, SessionErrorReason, SessionPhase } from '@/domain';
import { DEFAULT_THOR_HOST, type AdapterChoice, type AdapterSettings } from '@/stores/settings';
import { isAllowedHost } from '@/transport/host';

export type StepState = 'pending' | 'active' | 'done';

export type ConnectErrorReason = SessionErrorReason;

export const MAX_PORT = 65535;
export const VIN_VISIBLE_CHARS = 7;

const ERROR_REASONS: readonly ConnectErrorReason[] = [
  'adapterUnreachable',
  'bluetoothOff',
  'bluetoothDenied',
  'carNotResponding',
  'unsupportedVehicle',
  'connectionLost',
];

const ONLINE_PHASES: readonly SessionPhase[] = [
  'ready',
  'running',
  'restoring',
  'reconnecting',
  'disconnecting',
];

export const ADAPTER_IDS: Record<AdapterChoice, AdapterId> = {
  enet: 'enet',
  thor: 'thor',
  vgate: 'icar',
  demo: 'demo',
};

export const adapterChoiceOf = (adapter: AdapterId | undefined): AdapterChoice | undefined =>
  (Object.keys(ADAPTER_IDS) as AdapterChoice[]).find((choice) => ADAPTER_IDS[choice] === adapter);

export const isOnlinePhase = (phase: SessionPhase): boolean => ONLINE_PHASES.includes(phase);

export const toErrorReason = (reason: string | undefined): ConnectErrorReason =>
  ERROR_REASONS.find((candidate) => candidate === reason) ?? 'adapterUnreachable';

export const isHostValid = (host: string): boolean => host === '' || isAllowedHost(host.trim());

export const parsePort = (port: string): number | undefined => {
  if (!/^\d{1,5}$/.test(port.trim())) return undefined;

  const value = Number(port);

  return value >= 1 && value <= MAX_PORT ? value : undefined;
};

export const toAdapterConfig = (settings: AdapterSettings): AdapterConfig | undefined => {
  switch (settings.adapter) {
    case 'enet': {
      const host = settings.enetHost.trim();
      if (!isHostValid(host)) return undefined;

      if (host) return { adapter: 'enet', host };

      const preferredHost = settings.lastEnetHost.trim();

      return isAllowedHost(preferredHost)
        ? { adapter: 'enet', preferredHost }
        : { adapter: 'enet' };
    }
    case 'thor': {
      const host = settings.thorHost.trim() || DEFAULT_THOR_HOST;
      const port = parsePort(settings.thorPort);
      if (!isAllowedHost(host) || port === undefined) return undefined;

      return { adapter: 'thor', host, port };
    }
    case 'vgate':
      return settings.icarDevice
        ? { adapter: 'icar', deviceId: settings.icarDevice.id }
        : undefined;
    case 'demo':
      return { adapter: 'demo', chassis: settings.demoChassis };
  }
};

export const CONNECT_STEP_COUNT = 3;

export const reachedSteps = (phase: SessionPhase): number => {
  if (phase === 'identifying') return 1;
  if (isOnlinePhase(phase)) return CONNECT_STEP_COUNT;

  return 0;
};

export const stepStates = (shown: number): StepState[] =>
  Array.from({ length: CONNECT_STEP_COUNT }, (_, index) => {
    if (index < shown) return 'done';

    return index === shown ? 'active' : 'pending';
  });

export const maskVin = (vin: string): string => {
  const hidden = Math.max(0, vin.length - VIN_VISIBLE_CHARS);

  return `${'•'.repeat(hidden)}${vin.slice(hidden)}`;
};

export const chassisLabel = (code: string): string => {
  const series = loadVehicles().find((entry) => entry.code === code)?.series;
  if (!series) return code;

  const descriptor = series
    .replace(code, '')
    .replace(/\bLCI\b/, '')
    .replace(/'/, ' Series')
    .replace(/\s+/g, ' ')
    .trim();

  return descriptor ? `${code} · ${descriptor}` : code;
};

export interface ChassisOption {
  code: string;
  label: string;
}

export const chassisOptions = (): ChassisOption[] => {
  const codes = [...new Set(loadVehicles().map((entry) => entry.code))];

  return codes.map((code) => ({ code, label: chassisLabel(code) }));
};
