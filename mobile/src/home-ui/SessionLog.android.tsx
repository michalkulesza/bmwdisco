import { memo, useCallback, useState } from 'react';
import { AnimatedVisibility, Card, Column, EnterTransition, ExitTransition, Host, Text, TextButton } from '@expo/ui/jetpack-compose';
import { clickable, fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';

interface Props {
  logs: readonly string[];
  onExport: () => void;
}

const colors = { container: '#0A1424', content: '#F2F6FF', muted: '#9BAAC1' };

const SessionLog = ({ logs, onExport }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const handleToggle = useCallback(() => setExpanded(value => !value), []);
  const recent = logs.slice(-8).join('\n') || 'Connection and preset activity will appear here.';
  const title = `Session log · ${logs.length}`;
  const chevron = expanded ? '▴' : '▾';

  return <Host matchContents={{ vertical: true }} colorScheme="dark" style={{ alignSelf: 'stretch' }}>
    <Card colors={{ containerColor: colors.container, contentColor: colors.content }} modifiers={[fillMaxWidth()]}>
      <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), paddingAll(16)]}>
        <Text color={colors.content} style={{ typography: 'titleMedium' }} modifiers={[fillMaxWidth(), clickable(handleToggle)]}>{`${title}  ${chevron}`}</Text>
        <AnimatedVisibility visible={expanded} enterTransition={EnterTransition.expandVertically().plus(EnterTransition.fadeIn())} exitTransition={ExitTransition.shrinkVertically().plus(ExitTransition.fadeOut())}>
          <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
            <Text color={colors.muted} style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 15 }}>{recent}</Text>
            <TextButton enabled={logs.length > 0} onClick={onExport}><Text>Export logs</Text></TextButton>
          </Column>
        </AnimatedVisibility>
      </Column>
    </Card>
  </Host>;
};

export default memo(SessionLog);
