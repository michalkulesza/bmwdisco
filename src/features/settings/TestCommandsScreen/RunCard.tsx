import CardShell from './CardShell';
import RunActionButton from './RunActionButton';

import type { RunAction, RunCardConfig } from './helpers';

interface RunCardProps {
  card: RunCardConfig;
  runningId?: string;
  disabled: boolean;
  onRun: (action: RunAction) => void;
}

const RunCard = ({ card, runningId, disabled, onRun }: RunCardProps) => (
  <CardShell title={card.title} description={card.description}>
    {card.actions.map((action) => (
      <RunActionButton
        key={action.id}
        action={action}
        running={runningId === action.id}
        disabled={disabled}
        onRun={onRun}
      />
    ))}
  </CardShell>
);

export default RunCard;
