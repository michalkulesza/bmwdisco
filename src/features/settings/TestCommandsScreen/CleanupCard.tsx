import { Broom } from 'phosphor-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/ui/Button';
import { selectionHaptic } from '@/ui/haptics';

import CardShell from './CardShell';

interface CleanupCardProps {
  running: boolean;
  disabled: boolean;
  onCleanup: () => void;
}

const CleanupCard = ({ running, disabled, onCleanup }: CleanupCardProps) => {
  const { t } = useTranslation();

  const handlePress = useCallback(() => {
    selectionHaptic();
    onCleanup();
  }, [onCleanup]);

  return (
    <CardShell
      title={t('testCommands.groups.cleanup.title')}
      description={t('testCommands.groups.cleanup.description')}
    >
      <Button
        label={t('testCommands.groups.cleanup.run')}
        icon={Broom}
        variant="secondary"
        loading={running}
        disabled={disabled}
        onPress={handlePress}
      />
    </CardShell>
  );
};

export default CleanupCard;
