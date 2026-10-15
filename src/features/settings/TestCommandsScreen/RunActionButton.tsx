import { Play } from 'phosphor-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/ui/Button';
import { selectionHaptic } from '@/ui/haptics';

import type { RunAction } from './helpers';

interface RunActionButtonProps {
  action: RunAction;
  running: boolean;
  disabled: boolean;
  onRun: (action: RunAction) => void;
}

const RunActionButton = ({ action, running, disabled, onRun }: RunActionButtonProps) => {
  const { t } = useTranslation();
  const accessibilityLabel = `${t('testCommands.run')} ${action.label}`;

  const handlePress = useCallback(() => {
    selectionHaptic();
    onRun(action);
  }, [action, onRun]);

  return (
    <Button
      label={action.label}
      icon={Play}
      variant="secondary"
      loading={running}
      disabled={disabled}
      onPress={handlePress}
      accessibilityLabel={accessibilityLabel}
    />
  );
};

export default RunActionButton;
