import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/i18n';
import { createLink, type AdapterConfig, type LinkFactoryDeps, type SessionDeps } from '@/domain';
import { SessionProvider } from '@/session';
import { SimulatedVehicle } from '@/simulator/simulated-vehicle';

import type { ReactElement } from 'react';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export const DEMO_CONFIG: AdapterConfig = { adapter: 'demo', chassis: 'F32', seed: 1 };

export const makeDeps = (
  overrides: Partial<SessionDeps> = {},
  linkDeps: Partial<LinkFactoryDeps> = {},
): SessionDeps => ({
  createLink: (config, signal) =>
    createLink(
      config,
      { createTcpTransport: jest.fn(), createBleTransport: jest.fn(), ...linkDeps },
      signal,
    ),
  appState: { subscribe: () => () => undefined },
  probeTimeoutMs: 30,
  ...overrides,
});

export const unsupportedVehicleDeps = (): SessionDeps =>
  makeDeps(
    {},
    {
      createVehicle: () =>
        new SimulatedVehicle({ profile: { chassis: 'F32', modules: ['KOMB25'] } }),
    },
  );

export const renderWithSession = (ui: ReactElement, deps: SessionDeps = makeDeps()) =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <SessionProvider deps={deps}>{ui}</SessionProvider>
    </SafeAreaProvider>,
  );
