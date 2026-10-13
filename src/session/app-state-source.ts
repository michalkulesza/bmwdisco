import { AppState } from 'react-native';

import type { AppStateSource, AppStateStatus } from '@/domain';

const toStatus = (state: string): AppStateStatus =>
  state === 'active' || state === 'background' ? state : 'inactive';

export const reactNativeAppState: AppStateSource = {
  subscribe: (listener) => {
    const subscription = AppState.addEventListener('change', (state) => listener(toStatus(state)));

    return () => subscription.remove();
  },
};
