import { createLink, type LinkFactoryDeps, type SessionDeps } from '@/domain';
import { useVehicleFactsStore } from '@/stores/vehicle-facts';

import { reactNativeAppState } from './app-state-source';

// Lazy so Jest and Demo-only paths never load the native transport modules.
const loadNativeLinkDeps = (): LinkFactoryDeps =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('@/domain/adapter/native-deps') as typeof import('@/domain/adapter/native-deps'))
    .nativeLinkDeps;

export const createSessionDeps = (): SessionDeps => ({
  beginVehicleSession: () => useVehicleFactsStore.getState().clearSessionProfile(),
  loadVehicleFacts: (car, demo) => useVehicleFactsStore.getState().getProfile(car, demo),
  saveVehicleFacts: (car, facts, validations, demo) =>
    useVehicleFactsStore.getState().recordReadyFacts(car, facts, validations, demo),
  createLink: (config, signal) => createLink(config, loadNativeLinkDeps(), signal),
  appState: reactNativeAppState,
  debug: __DEV__,
});
