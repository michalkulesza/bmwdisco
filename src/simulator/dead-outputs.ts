import type { ElementId } from '@/data/elements';
import type { ModuleSgbd } from '@/data/generated';

interface DeadOutputRule {
  sgbd: ModuleSgbd;
  elements: readonly ElementId[];
  whenAnyPresent: readonly ModuleSgbd[];
}

// F32 car test: these outputs get a positive reply but drive nothing when the listed modules exist.
const DEAD_OUTPUT_RULES: readonly DeadOutputRule[] = [
  {
    sgbd: 'FEM_20',
    whenAnyPresent: ['FLE02_L', 'FLE02_R'],
    elements: [
      'lowBeamLeft',
      'lowBeamRight',
      'highBeamLeft',
      'highBeamRight',
      'daytimeLeft',
      'daytimeRight',
    ],
  },
  { sgbd: 'FEM_20', whenAnyPresent: ['REM_20'], elements: ['brakeAll'] },
];

export const deadOutputsOf = (
  sgbd: ModuleSgbd,
  modules: readonly ModuleSgbd[],
): ReadonlySet<ElementId> =>
  new Set(
    DEAD_OUTPUT_RULES.filter(
      (rule) => rule.sgbd === sgbd && rule.whenAnyPresent.some((other) => modules.includes(other)),
    ).flatMap((rule) => rule.elements),
  );
