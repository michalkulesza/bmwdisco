import { useEffect, useRef, useState } from 'react';

import type { SessionPhase } from '@/domain';

import { CONNECT_STEP_COUNT, reachedSteps } from './helpers';

export const MIN_STEP_MS = 1000;
export const SUMMARY_HOLD_MS = 1500;

export const usePacedSteps = (phase: SessionPhase) => {
  const [shown, setShown] = useState(0);
  const [settled, setSettled] = useState(false);
  const activeSince = useRef<number | null>(null);
  const reached = reachedSteps(phase);

  useEffect(() => {
    if (shown < reached) {
      const since = activeSince.current ?? Date.now();
      activeSince.current = since;
      const remaining = Math.max(0, MIN_STEP_MS - (Date.now() - since));
      const timer = setTimeout(() => {
        activeSince.current = Date.now();
        setShown((count) => count + 1);
      }, remaining);

      return () => clearTimeout(timer);
    }

    if (shown === CONNECT_STEP_COUNT) {
      const timer = setTimeout(() => setSettled(true), SUMMARY_HOLD_MS);

      return () => clearTimeout(timer);
    }
  }, [shown, reached]);

  return { shown, settled };
};
