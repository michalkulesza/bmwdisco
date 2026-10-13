import { OFF_PARAMS, ON_PARAMS } from './assemble';
import { ELEMENT_MAP, SESSION_AND_CLEANUP_COMMANDS } from './element-map';

import type { PackAction, PackFile, PackStep } from './schemas';
import type { Effect, EffectStep, Module } from '../../src/data/types';

export type DropReason = 'unmapped' | 'unavailable' | 'empty' | 'unpaired';

export interface DroppedEffect {
  pack: string;
  title: string;
  reason: DropReason;
  commands: string[];
}

export interface PackReport {
  pack: string;
  total: number;
  kept: number;
  dropped: DroppedEffect[];
}

export interface BuiltEffects {
  effects: Effect[];
  reports: PackReport[];
}

interface ParsedAction {
  steps: EffectStep[];
  clusterFeedback: boolean;
  silenceCommunication: boolean;
  missing: { reason: DropReason; command: string }[];
}

const TOGGLE_SUFFIX = /\s+(ON|OFF)$/;

export const camelCase = (text: string) =>
  text
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toLowerCase() + word.slice(1)
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join('');

const stepState = (step: PackStep): boolean => {
  const params = step.params;
  if (
    params?.param_aktion === ON_PARAMS.param_aktion &&
    params.param_zeit === ON_PARAMS.param_zeit
  ) {
    return true;
  }
  if (
    params?.param_aktion === OFF_PARAMS.param_aktion &&
    params.param_zeit === OFF_PARAMS.param_zeit
  ) {
    return false;
  }
  throw new Error(`Step ${step.command} carries an unexpected parameter set`);
};

const providedElements = (modules: readonly Module[]) =>
  new Set(modules.flatMap((module) => Object.keys(module.elements)));

const parseAction = (action: PackAction, provided: ReadonlySet<string>): ParsedAction => {
  const parsed: ParsedAction = {
    steps: [],
    clusterFeedback: false,
    silenceCommunication: false,
    missing: [],
  };

  for (const step of action.sequence) {
    if (step.command === 'KOMBI_ON') parsed.clusterFeedback = true;
    if (step.command === 'COMMUNICATION_OFF') parsed.silenceCommunication = true;
    if (SESSION_AND_CLEANUP_COMMANDS.has(step.command)) continue;

    const element = ELEMENT_MAP[step.command];
    if (!element) {
      parsed.missing.push({ reason: 'unmapped', command: step.command });
      continue;
    }
    if (!provided.has(element)) {
      parsed.missing.push({ reason: 'unavailable', command: step.command });
      continue;
    }

    parsed.steps.push({ element, on: stepState(step) });
  }

  for (const step of action.disable) {
    if (SESSION_AND_CLEANUP_COMMANDS.has(step.command)) continue;
    if (stepState(step)) throw new Error(`Cleanup step ${step.command} turns something on`);
  }

  return parsed;
};

const requiredModulesFor = (steps: readonly EffectStep[], modules: readonly Module[]) =>
  modules
    .filter((module) => steps.some((step) => module.elements[step.element]))
    .map((module) => module.sgbd)
    .sort();

const dropReasonOf = (parsed: ParsedAction): DroppedEffect['reason'] | null => {
  if (parsed.missing.length > 0) return parsed.missing[0]?.reason ?? 'unmapped';
  if (parsed.steps.length === 0) return 'empty';
  return null;
};

const buildEffect = (
  pack: string,
  action: PackAction,
  title: string,
  parsed: ParsedAction,
  modules: readonly Module[],
  extra: Pick<Effect, 'kind'> & Partial<Pick<Effect, 'offSteps'>>,
): Effect => {
  const slug = camelCase(title);
  const packKey = camelCase(pack);
  const allSteps = [...parsed.steps, ...(extra.offSteps ?? [])];

  return {
    id: `${pack}.${slug}`,
    pack,
    nameKey: `effects.${packKey}.${slug}`,
    ...(action.section ? { sectionKey: `effects.sections.${camelCase(action.section)}` } : {}),
    kind: extra.kind,
    steps: parsed.steps,
    ...(extra.offSteps ? { offSteps: extra.offSteps } : {}),
    clusterFeedback: parsed.clusterFeedback,
    silenceCommunication: parsed.silenceCommunication,
    requiredModules: requiredModulesFor(allSteps, modules),
  };
};

const toggleStem = (title: string) => title.replace(TOGGLE_SUFFIX, '');

const buildToggleEffects = (
  pack: string,
  file: PackFile,
  provided: ReadonlySet<string>,
  modules: readonly Module[],
  report: PackReport,
): Effect[] => {
  const effects: Effect[] = [];
  const parsedByTitle = new Map(
    file.actions.map((action) => [action.title, parseAction(action, provided)]),
  );

  for (const action of file.actions) {
    if (!/\sON$/.test(action.title)) continue;

    const stem = toggleStem(action.title);
    const offAction = file.actions.find((candidate) => candidate.title === `${stem} OFF`);
    const onParsed = parsedByTitle.get(action.title);
    const offParsed = parsedByTitle.get(`${stem} OFF`);

    if (!offAction || !onParsed || !offParsed) {
      report.dropped.push({ pack, title: action.title, reason: 'unpaired', commands: [] });
      continue;
    }

    const reason = dropReasonOf(onParsed) ?? dropReasonOf(offParsed);
    if (reason) {
      const commands = [...onParsed.missing, ...offParsed.missing].map((item) => item.command);
      report.dropped.push({ pack, title: stem, reason, commands: [...new Set(commands)] });
      continue;
    }

    effects.push(
      buildEffect(pack, action, stem, onParsed, modules, {
        kind: 'toggle',
        offSteps: offParsed.steps,
      }),
    );
    report.kept += 1;
  }

  return effects;
};

const buildOneShotEffects = (
  pack: string,
  file: PackFile,
  provided: ReadonlySet<string>,
  modules: readonly Module[],
  report: PackReport,
): Effect[] => {
  const effects: Effect[] = [];

  for (const action of file.actions) {
    const parsed = parseAction(action, provided);
    // Full OFF spans legacy ECUs too; retain the supported F-series light commands.
    const reason =
      pack === 'ghost' && action.title === 'Full OFF'
        ? parsed.steps.length === 0
          ? 'empty'
          : null
        : dropReasonOf(parsed);

    if (reason) {
      const commands = [...new Set(parsed.missing.map((item) => item.command))];
      report.dropped.push({ pack, title: action.title, reason, commands });
      continue;
    }

    effects.push(buildEffect(pack, action, action.title, parsed, modules, { kind: 'oneShot' }));
    report.kept += 1;
  }

  return effects;
};

export const buildEffects = (
  packs: Readonly<Record<string, PackFile>>,
  modules: readonly Module[],
): BuiltEffects => {
  const provided = providedElements(modules);
  const effects: Effect[] = [];
  const reports: PackReport[] = [];

  for (const [pack, file] of Object.entries(packs)) {
    const isToggle = pack === 'toggle';
    const total = isToggle ? file.actions.length / 2 : file.actions.length;
    const report: PackReport = { pack, total, kept: 0, dropped: [] };
    const build = isToggle ? buildToggleEffects : buildOneShotEffects;

    effects.push(...build(pack, file, provided, modules, report));
    reports.push(report);
  }

  const ids = effects.map((effect) => effect.id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) throw new Error(`Duplicate effect id ${duplicate}`);

  return { effects, reports };
};
