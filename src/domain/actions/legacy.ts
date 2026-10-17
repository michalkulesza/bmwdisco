import type { ElementId } from '@/data/elements';

import type { LogicalActionId } from './types';

export const LEGACY_ACTION_BRIDGES: Partial<Record<ElementId, LogicalActionId>> = {
  indicatorLeftAll: 'indicatorsLeft',
  indicatorRightAll: 'indicatorsRight',
  highBeamAll: 'bothHighBeams',
  lowBeamAll: 'bothLowBeams',
  brakeAll: 'brakesAll',
};
