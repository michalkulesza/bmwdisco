import type { ElementId } from '@/data/elements';

import { SUBSTITUTION_RULES } from './rules';

import type { DetectedModule, ElementTarget } from './types';

const addTarget = (targets: Map<ElementId, ElementTarget[]>, target: ElementTarget): void => {
  targets.set(target.element, [...(targets.get(target.element) ?? []), target]);
};

export const buildElementTargets = (
  modules: readonly DetectedModule[],
): Map<ElementId, ElementTarget[]> => {
  const targets = new Map<ElementId, ElementTarget[]>();
  for (const module of modules) {
    for (const element of Object.keys(module.module.elements) as ElementId[]) {
      addTarget(targets, { module, element });
    }
  }

  for (const rule of SUBSTITUTION_RULES) {
    const provider = modules.find((module) => module.sgbd === rule.whenPresent);
    if (!provider || !rule.use.every((element) => provider.module.elements[element])) continue;

    targets.set(
      rule.element,
      rule.use.map((element) => ({ module: provider, element })),
    );
  }

  return targets;
};

export const sourcesOf = (
  targets: ReadonlyMap<ElementId, readonly ElementTarget[]>,
): Map<ElementId, DetectedModule[]> =>
  new Map(
    [...targets].map(([element, list]) => [
      element,
      [...new Set(list.map(({ module }) => module))],
    ]),
  );
