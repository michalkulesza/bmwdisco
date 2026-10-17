import type { ElementId } from '@/data/elements';
import type { LogicalActionId } from '@/domain/actions/catalog';

export type LightSelection =
  { kind: 'legacy'; id: ElementId } | { kind: 'action'; id: LogicalActionId };

export const selectionKey = (selection: LightSelection): string =>
  `${selection.kind}:${selection.id}`;

export const parseSelectionKey = (value: string): LightSelection | undefined => {
  const separator = value.indexOf(':');
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (kind === 'action') return { kind, id: id as LogicalActionId };
  if (kind === 'legacy') return { kind, id: id as ElementId };
  return undefined;
};
