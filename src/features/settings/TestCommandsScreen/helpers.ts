import {
  cleanupAllGroup,
  d542IndicatorGroup,
  ecuNameOf,
  femIndicatorGroup,
  formatEcuAddress,
  hazardGroup,
  identityGroup,
  lhm2DataOf,
  remIndicatorGroup,
  splitLhm2Record,
  type DetectedCar,
  type ExchangeOutcome,
  type GroupResult,
  type Lhm2Snapshot,
  type RawExchange,
  type TestBlockReason,
  type TestGroup,
  type TestUsage,
} from '@/domain';
import { hex } from '@/protocol/bytes';
import { describeNrc } from '@/protocol/nrc';

import type { TFunction } from 'i18next';

export const MAX_VISIBLE_LOG_ENTRIES = 60;

export const toHexByte = (value: number): string =>
  value.toString(16).toUpperCase().padStart(2, '0');

export const SNAPSHOT_LABELS = [
  'lightsOff',
  'stalkLeft',
  'stalkRight',
  'lowBeam',
  'highBeam',
  'drl',
] as const;

export type SnapshotLabel = (typeof SNAPSHOT_LABELS)[number];

export const LHM2_HOLD_OPTIONS = [300, 500, 1000, 2000, 3000] as const;

export const LHM2_CHANNEL_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export type LogEntry =
  | { key: number; kind: 'exchange'; exchange: RawExchange }
  | { key: number; kind: 'note'; at: number; text: string };

export interface RunAction {
  id: string;
  label: string;
  group: TestGroup;
}

export interface RunCardConfig {
  id: string;
  title: string;
  description: string;
  actions: RunAction[];
}

export type BlockedReason = TestBlockReason | 'busy';

export const buildRunCards = (t: TFunction): RunCardConfig[] => [
  {
    id: 'identity',
    title: t('testCommands.groups.identity.title'),
    description: t('testCommands.groups.identity.description'),
    actions: [
      {
        id: 'identity',
        label: t('testCommands.groups.identity.run'),
        group: identityGroup,
      },
    ],
  },
  {
    id: 'hazard',
    title: t('testCommands.groups.hazard.title'),
    description: t('testCommands.groups.hazard.description'),
    actions: [{ id: 'hazard', label: t('testCommands.groups.hazard.run'), group: hazardGroup }],
  },
  {
    id: 'd542',
    title: t('testCommands.groups.d542.title'),
    description: t('testCommands.groups.d542.description'),
    actions: [
      {
        id: 'd542Left',
        label: t('testCommands.groups.d542.left'),
        group: d542IndicatorGroup('left'),
      },
      {
        id: 'd542Right',
        label: t('testCommands.groups.d542.right'),
        group: d542IndicatorGroup('right'),
      },
    ],
  },
  {
    id: 'fem',
    title: t('testCommands.groups.fem.title'),
    description: t('testCommands.groups.fem.description'),
    actions: [
      {
        id: 'fem10',
        label: t('testCommands.groups.fem.channel10'),
        group: femIndicatorGroup(0x10),
      },
      {
        id: 'fem11',
        label: t('testCommands.groups.fem.channel11'),
        group: femIndicatorGroup(0x11),
      },
      {
        id: 'fem0d',
        label: t('testCommands.groups.fem.channel0d'),
        group: femIndicatorGroup(0x0d),
      },
      {
        id: 'fem0e',
        label: t('testCommands.groups.fem.channel0e'),
        group: femIndicatorGroup(0x0e),
      },
    ],
  },
  {
    id: 'rem',
    title: t('testCommands.groups.rem.title'),
    description: t('testCommands.groups.rem.description'),
    actions: [
      {
        id: 'remLeft',
        label: t('testCommands.groups.rem.left'),
        group: remIndicatorGroup('left'),
      },
      {
        id: 'remRight',
        label: t('testCommands.groups.rem.right'),
        group: remIndicatorGroup('right'),
      },
    ],
  },
];

export const buildCleanupAction = (t: TFunction, usage: TestUsage): RunAction => ({
  id: 'cleanupAll',
  label: t('testCommands.groups.cleanup.run'),
  group: cleanupAllGroup(usage),
});

export const ecuLabel = (address: number, car?: DetectedCar): string => {
  const name = ecuNameOf(address, car);
  const formatted = formatEcuAddress(address);

  return name ? `${name} ${formatted}` : formatted;
};

export const decodeOutcome = (outcome: ExchangeOutcome, t: TFunction): string => {
  switch (outcome.kind) {
    case 'positive':
      return t('testCommands.result.positive');
    case 'negative':
      return t('testCommands.result.nrc', {
        code: `0x${outcome.nrc.toString(16).toUpperCase().padStart(2, '0')}`,
        name: describeNrc(outcome.nrc),
      });
    case 'timeout':
      return t('testCommands.result.timeout');
    case 'error':
      return t('testCommands.result.error', { message: outcome.message });
  }
};

export const responseHexOf = (outcome: ExchangeOutcome): string =>
  outcome.kind === 'positive' || outcome.kind === 'negative' ? hex(outcome.response) : '-';

export const formatTime = (at: number): string => {
  const date = new Date(at);
  const part = (value: number, width = 2) => String(value).padStart(width, '0');

  return `${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}.${part(date.getMilliseconds(), 3)}`;
};

export const formatExchangeLine = (
  exchange: RawExchange,
  t: TFunction,
  car?: DetectedCar,
): string => {
  const cleanup = exchange.stage === 'cleanup' ? ` [${t('testCommands.results.cleanupTag')}]` : '';
  const response = responseHexOf(exchange.outcome);

  return `${formatTime(exchange.at)} ${ecuLabel(exchange.ecu, car)}${cleanup} > ${hex(exchange.request)} < ${response} = ${decodeOutcome(exchange.outcome, t)}`;
};

export const formatEntryLine = (entry: LogEntry, t: TFunction, car?: DetectedCar): string =>
  entry.kind === 'exchange'
    ? formatExchangeLine(entry.exchange, t, car)
    : `${formatTime(entry.at)} -- ${entry.text}`;

export const formatSnapshotLines = (snapshots: readonly Lhm2Snapshot[]): string[] =>
  snapshots.map((snapshot) => {
    const { pwm, current } = splitLhm2Record(snapshot.data);

    return `${snapshot.label} ${formatEcuAddress(snapshot.ecu)} PWM ${pwm.join(' ')} | I ${current.join(' ')}`;
  });

export const formatResultsText = (
  entries: readonly LogEntry[],
  snapshots: readonly Lhm2Snapshot[],
  t: TFunction,
  car?: DetectedCar,
): string => {
  const lines = [
    'BimmerDisco test results',
    `Chassis: ${car?.chassis ?? 'unknown'}`,
    `Modules: ${car?.modules.map((module) => module.sgbd).join(', ') || 'none'}`,
    '',
    ...entries.map((entry) => formatEntryLine(entry, t, car)),
  ];
  if (snapshots.length === 0) return lines.join('\n');

  return [
    ...lines,
    '',
    t('testCommands.results.snapshotsTitle'),
    ...formatSnapshotLines(snapshots),
  ].join('\n');
};

export const readingsOf = (result: GroupResult): Map<number, Uint8Array> => {
  const readings = new Map<number, Uint8Array>();
  for (const { ecu, outcome } of result.exchanges) {
    const data = outcome.kind === 'positive' ? lhm2DataOf(outcome.response) : undefined;
    if (data) readings.set(ecu, data);
  }

  return readings;
};

export const noteForResult = (result: GroupResult, name: string, t: TFunction): string => {
  if (result.status === 'aborted') return t('testCommands.notes.aborted', { name });
  if (result.status === 'completed') return t('testCommands.notes.completed', { name });
  if (result.failure?.kind === 'error') {
    const reason = t(`testCommands.notes.reasons.${result.failure.code as 'unexpected'}`, {
      defaultValue: result.failure.message ?? result.failure.code,
    });

    return t('testCommands.notes.failedWith', { name, reason });
  }

  return t('testCommands.notes.failed', { name });
};

export const blockedReasonText = (reason: BlockedReason, t: TFunction): string =>
  t(`testCommands.blocked.${reason}`);

export const snapshotLabelText = (
  label: SnapshotLabel | undefined,
  custom: string,
  t: TFunction,
) => {
  const trimmed = custom.trim();
  if (trimmed) return trimmed;

  return label ? t(`testCommands.groups.lhm2Read.labels.${label}`) : '';
};
