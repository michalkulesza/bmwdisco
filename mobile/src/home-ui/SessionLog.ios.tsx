import { memo, useState } from 'react';
import { Button, DisclosureGroup, Host, Text, VStack } from '@expo/ui/swift-ui';
import { disabled, font, foregroundStyle, frame, textSelection } from '@expo/ui/swift-ui/modifiers';

interface Props {
  logs: readonly string[];
  onExport: () => void;
}

const logModifiers = [font({ size: 11, design: 'monospaced' }), foregroundStyle('secondary'), textSelection(true), frame({ maxWidth: Infinity, alignment: 'leading' })];

const SessionLog = ({ logs, onExport }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const recent = logs.slice(-8).join('\n') || 'Connection and preset activity will appear here.';
  const title = `Session log · ${logs.length}`;

  return <Host matchContents={{ vertical: true }} colorScheme="dark" style={{ alignSelf: 'stretch' }}>
    <DisclosureGroup label={title} isExpanded={expanded} onIsExpandedChange={setExpanded}>
      <VStack alignment="leading" spacing={12}>
        <Text modifiers={logModifiers}>{recent}</Text>
        <Button label="Export logs" systemImage="square.and.arrow.up" onPress={onExport} modifiers={[disabled(logs.length === 0)]} />
      </VStack>
    </DisclosureGroup>
  </Host>;
};

export default memo(SessionLog);
