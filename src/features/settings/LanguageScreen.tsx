import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { LANGUAGE_CHOICES, useSettingsStore, type LanguageChoice } from '@/stores/settings';
import { selectionHaptic } from '@/ui/haptics';
import ListGroup from '@/ui/ListGroup';
import ListRow from '@/ui/ListRow';
import Screen from '@/ui/Screen';

interface LanguageOptionProps {
  choice: LanguageChoice;
}

const LanguageOption = ({ choice }: LanguageOptionProps) => {
  const { t } = useTranslation();
  const selected = useSettingsStore((state) => state.language === choice);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  const handlePress = useCallback(() => {
    selectionHaptic();
    setLanguage(choice);
  }, [choice, setLanguage]);

  return (
    <ListRow
      label={t(`settings.languageOptions.${choice}`)}
      checked={selected}
      onPress={handlePress}
    />
  );
};

const LanguageScreen = () => (
  <Screen>
    <ListGroup>
      {LANGUAGE_CHOICES.map((choice) => (
        <LanguageOption key={choice} choice={choice} />
      ))}
    </ListGroup>
  </Screen>
);

export default LanguageScreen;
