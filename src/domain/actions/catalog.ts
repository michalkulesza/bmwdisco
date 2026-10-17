export { LOGICAL_ACTION_IDS, isLogicalActionId } from './types';
export type { LogicalActionId } from './types';

export const LOGICAL_ACTION_CATALOG = [
  { id: 'indicatorsLeft', labelKey: 'actions.names.indicatorsLeft' },
  { id: 'indicatorsRight', labelKey: 'actions.names.indicatorsRight' },
  { id: 'bothHighBeams', labelKey: 'actions.names.bothHighBeams' },
  { id: 'highBeamLeft', labelKey: 'actions.names.highBeamLeft' },
  { id: 'highBeamRight', labelKey: 'actions.names.highBeamRight' },
  { id: 'lowBeamLeft', labelKey: 'actions.names.lowBeamLeft' },
  { id: 'lowBeamRight', labelKey: 'actions.names.lowBeamRight' },
  { id: 'bothLowBeams', labelKey: 'actions.names.bothLowBeams' },
  { id: 'corneringLeft', labelKey: 'actions.names.corneringLeft' },
  { id: 'corneringRight', labelKey: 'actions.names.corneringRight' },
  { id: 'brakesAll', labelKey: 'actions.names.brakesAll' },
  { id: 'biXenonShutterBoth', labelKey: 'actions.names.biXenonShutterBoth' },
] as const;
