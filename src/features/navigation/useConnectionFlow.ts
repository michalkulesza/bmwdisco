import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import type { SessionPhase } from '@/domain';
import { isOnlinePhase } from '@/features/connect/helpers';
import { useSessionPhase } from '@/session';
import { errorHaptic, successHaptic } from '@/ui/haptics';

const CONNECTING_PHASES: readonly SessionPhase[] = ['connecting', 'identifying', 'restoring'];
const OFFLINE_PHASES: readonly SessionPhase[] = ['idle', 'disconnected', 'error'];

const goToConnect = () => {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
};

export const useConnectionFlow = () => {
  const phase = useSessionPhase();
  const pathname = usePathname();
  const previousPhase = useRef(phase);

  useEffect(() => {
    const before = previousPhase.current;
    if (before === phase) return;
    previousPhase.current = phase;

    if (phase === 'ready' && CONNECTING_PHASES.includes(before)) {
      if (pathname !== '/') successHaptic();

      return;
    }

    if (phase === 'error') errorHaptic();

    const wentOffline = OFFLINE_PHASES.includes(phase) && isOnlinePhase(before);
    if (wentOffline && pathname !== '/') goToConnect();
  }, [phase, pathname]);
};
