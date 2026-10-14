import type { SessionContext, SessionPhase } from '@/domain';
import { useSettingsStore } from '@/stores/settings';

const HOST_PLACEHOLDER = '[host omitted]';

const knownHosts = (context: SessionContext): string[] => {
  const { enetHost, lastEnetHost } = useSettingsStore.getState();

  return [enetHost, lastEnetHost, context.link?.host ?? '']
    .map((host) => host.trim())
    .filter(Boolean);
};

export const formatDiagnosticLog = (context: SessionContext, phase: SessionPhase): string => {
  const lines = [
    'BimmerDisco diagnostic log',
    `Captured: ${new Date().toISOString()}`,
    `Adapter: ${context.adapter ?? 'none'}`,
    `Phase: ${phase}`,
    `Chassis: ${context.car?.chassis ?? 'unknown'}`,
    `Modules: ${context.car?.modules.map((module) => module.sgbd).join(', ') || 'none'}`,
    `Recording: ${context.diagnosticsEnabled ? 'on' : 'off'}`,
    `Lights may be under forced control: ${context.lightsMayBeOn}`,
    `Last error: ${context.lastError?.reason ?? 'none'}`,
    '',
    ...context.log.map((entry) => `${new Date(entry.at).toISOString()} ${entry.message}`),
  ];
  const text = knownHosts(context).reduce(
    (result, host) => result.replaceAll(host, HOST_PLACEHOLDER),
    lines.join('\n'),
  );

  return context.car?.vin ? text.replaceAll(context.car.vin, '[VIN omitted]') : text;
};
