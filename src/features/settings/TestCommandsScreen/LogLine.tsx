import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { DetectedCar } from '@/domain';
import Text from '@/ui/Text';

import { formatEntryLine, type LogEntry } from './helpers';

interface LogLineProps {
  entry: LogEntry;
  car?: DetectedCar;
}

const toneOf = (entry: LogEntry): 'default' | 'destructive' | 'muted' => {
  if (entry.kind === 'note') return 'muted';

  return entry.exchange.outcome.kind === 'positive' ? 'default' : 'destructive';
};

const LogLine = memo(({ entry, car }: LogLineProps) => {
  const { t } = useTranslation();
  const line = formatEntryLine(entry, t, car);

  return (
    <Text
      variant="small"
      tone={toneOf(entry)}
      className="font-geist-mono"
      accessibilityLabel={line}
    >
      {line}
    </Text>
  );
});
LogLine.displayName = 'LogLine';

export default LogLine;
