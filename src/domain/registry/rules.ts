import type { ElementId } from '@/data/elements';
import type { ModuleSgbd } from '@/data/generated';

export interface SubstitutionRule {
  element: ElementId;
  whenPresent: ModuleSgbd;
  use: readonly ElementId[];
}

export interface UnavailabilityRule {
  whenAnyPresent: readonly ModuleSgbd[];
  modules: readonly ModuleSgbd[];
  elements: readonly ElementId[];
}

// F32 car test: FEM D542 brake replied positively but lit nothing while REM_20 brakeLeft/Right lit.
export const SUBSTITUTION_RULES: readonly SubstitutionRule[] = [
  {
    element: 'brakeAll',
    whenPresent: 'REM_20',
    use: ['brakeLeft', 'brakeRight', 'brakeCenter'],
  },
];

// F32 car test: FEM/BDC per-side headlight outputs replied positively but lit nothing on LED headlights.
export const UNAVAILABILITY_RULES: readonly UnavailabilityRule[] = [
  {
    whenAnyPresent: ['FLE02_L', 'FLE02_R'],
    modules: ['FEM_20', 'BDC'],
    elements: [
      'lowBeamLeft',
      'lowBeamRight',
      'highBeamLeft',
      'highBeamRight',
      'daytimeLeft',
      'daytimeRight',
    ],
  },
];

export const hasElementWarning = (
  modules: readonly { sgbd: ModuleSgbd }[],
  element: ElementId,
): boolean =>
  UNAVAILABILITY_RULES.some(
    (rule) =>
      rule.elements.includes(element) &&
      modules.some((module) => rule.whenAnyPresent.includes(module.sgbd)) &&
      modules.some((module) => rule.modules.includes(module.sgbd)),
  );
