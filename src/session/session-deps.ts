import { createLink, type LinkFactoryDeps, type SessionDeps } from '@/domain';

import { reactNativeAppState } from './app-state-source';

// Lazy so Jest and Demo-only paths never load the native transport modules.
const loadNativeLinkDeps = (): LinkFactoryDeps =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('@/domain/adapter/native-deps') as typeof import('@/domain/adapter/native-deps'))
    .nativeLinkDeps;

export const createSessionDeps = (): SessionDeps => ({
  createLink: (config, signal) => createLink(config, loadNativeLinkDeps(), signal),
  appState: reactNativeAppState,
  debug: __DEV__,
});
