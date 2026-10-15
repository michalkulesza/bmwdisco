import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import CleanupCard from './CleanupCard';
import { buildRunCards } from './helpers';
import Lhm2ReadCard from './Lhm2ReadCard';
import Lhm2WriteCard from './Lhm2WriteCard';
import RawCommandCard from './RawCommandCard';
import RunCard from './RunCard';

import type { TestCommands } from './useTestCommands';

interface TestCardsProps {
  commands: TestCommands;
  disabled: boolean;
}

const TestCards = ({ commands, disabled }: TestCardsProps) => {
  const { t } = useTranslation();
  const cards = useMemo(() => buildRunCards(t), [t]);
  const { runningId } = commands;

  return (
    <>
      {cards.map((card) => (
        <RunCard
          key={card.id}
          card={card}
          runningId={runningId}
          disabled={disabled}
          onRun={commands.run}
        />
      ))}
      <Lhm2ReadCard
        readings={commands.readings}
        snapshots={commands.snapshots}
        runningId={runningId}
        disabled={disabled}
        onRead={commands.readLhm2}
        onSave={commands.saveSnapshot}
        onClearSnapshots={commands.clearSnapshots}
      />
      <Lhm2WriteCard runningId={runningId} disabled={disabled} onRun={commands.run} />
      <RawCommandCard
        car={commands.car}
        runningId={runningId}
        disabled={disabled}
        onSend={commands.sendRaw}
      />
      <CleanupCard
        running={runningId === 'cleanupAll'}
        disabled={disabled && !commands.held}
        onCleanup={commands.cleanupAll}
      />
    </>
  );
};

export default TestCards;
