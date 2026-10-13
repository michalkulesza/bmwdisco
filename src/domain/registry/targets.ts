import type { ElementId } from '@/data/elements';

import { SUBSTITUTION_RULES, UNAVAILABILITY_RULES } from './rules';

import type { DetectedModule, ElementTarget } from './types';

const isPresent = (modules: readonly DetectedModule[], sgbd: string): boolean =>
  modules.some((module) => module.sgbd === sgbd);

const addTarget = (targets: Map<ElementId, ElementTarget[]>, target: ElementTarget): void => {
  targets.set(target.element, [...(targets.get(target.element) ?? []), target]);
};

export const buildElementTargets = (
  modules: readonly DetectedModule[],
): Map<ElementId, ElementTarget[]> => {
  const activeRules = UNAVAILABILITY_RULES.filter((rule) =>
    rule.whenAnyPresent.some((sgbd) => isPresent(modules, sgbd)),
  );
  const isUnavailable = (module: DetectedModule, element: ElementId): boolean =>
    activeRules.some(
      (rule) => rule.modules.includes(module.sgbd) && rule.elements.includes(element),
    );

  const targets = new Map<ElementId, ElementTarget[]>();
  for (const module of modules) {
    for (const element of Object.keys(module.module.elements) as ElementId[]) {
      if (!isUnavailable(module, element)) addTarget(targets, { module, element });
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
