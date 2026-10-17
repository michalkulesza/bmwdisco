import { categoryOf, type ElementId } from '@/data/elements';
import { loadEffects } from '@/data/generated';

import { assessRunnable, contextOf } from '../actions/availability';
import { resolveLegacyElement } from '../actions/resolver';

import type { DetectedCar } from './types';

/** Derived state only. No diagnostic commands are issued to discover capabilities. */
export const deriveCapabilities = (car: DetectedCar): DetectedCar => {
  const context = contextOf(car);
  const selectableElements = ([...car.elementTargets.keys()] as ElementId[]).filter(
    (element) =>
      categoryOf(element) !== 'cluster' &&
      resolveLegacyElement(context, element).status === 'supported',
  );
  const effects = loadEffects().filter((effect) => {
    const assessment = assessRunnable(context, { kind: 'effect', effect });
    return assessment.status === 'runnable' || assessment.status === 'partial';
  });

  return { ...car, selectableElements, effects };
};
