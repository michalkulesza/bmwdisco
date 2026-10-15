import { PaperPlaneRight } from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import {
  ecuChoicesOf,
  formatEcuAddress,
  parseEcuAddress,
  parseHexBytes,
  requiresConfirmation,
  type DetectedCar,
} from '@/domain';
import { hex } from '@/protocol/bytes';
import Button from '@/ui/Button';
import { selectionHaptic } from '@/ui/haptics';

import FieldInput from '../FieldInput';

import CardShell from './CardShell';
import ChipGroup from './ChipGroup';

interface RawCommandCardProps {
  car?: DetectedCar;
  runningId?: string;
  disabled: boolean;
  onSend: (ecu: number, payload: Uint8Array) => void;
}

const RawCommandCard = ({ car, runningId, disabled, onSend }: RawCommandCardProps) => {
  const { t } = useTranslation();
  const [ecuText, setEcuText] = useState('');
  const [payloadText, setPayloadText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const ecu = parseEcuAddress(ecuText);
  const parsed = parseHexBytes(payloadText);
  const ecuError =
    submitted && ecu === undefined ? t('testCommands.groups.raw.errors.ecu') : undefined;
  const payloadError =
    submitted && !parsed.ok ? t(`testCommands.groups.raw.errors.${parsed.error}`) : undefined;
  const ecuOptions = useMemo(
    () =>
      ecuChoicesOf(car).map(({ address, name }) => ({
        value: formatEcuAddress(address),
        label: t('testCommands.groups.raw.ecuChoice', {
          name,
          address: formatEcuAddress(address),
        }),
      })),
    [car, t],
  );

  const handleSend = useCallback(
    (address: number, payload: Uint8Array) => {
      onSend(address, payload);
    },
    [onSend],
  );

  const handleSendPress = useCallback(() => {
    selectionHaptic();
    setSubmitted(true);
    if (ecu === undefined || !parsed.ok) return;

    const { bytes } = parsed;
    if (!requiresConfirmation(bytes)) {
      handleSend(ecu, bytes);

      return;
    }

    const handleConfirmed = () => handleSend(ecu, bytes);
    Alert.alert(
      t('testCommands.groups.raw.confirmTitle'),
      t('testCommands.groups.raw.confirmMessage', {
        request: hex(bytes),
        ecu: formatEcuAddress(ecu),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('testCommands.groups.raw.confirmSend'),
          style: 'destructive',
          onPress: handleConfirmed,
        },
      ],
    );
  }, [ecu, handleSend, parsed, t]);

  return (
    <CardShell
      title={t('testCommands.groups.raw.title')}
      description={t('testCommands.groups.raw.description')}
    >
      <View className="gap-3">
        {ecuOptions.length > 0 ? (
          <ChipGroup
            options={ecuOptions}
            value={ecu === undefined ? undefined : formatEcuAddress(ecu)}
            onChange={setEcuText}
            accessibilityLabel={t('testCommands.groups.raw.ecuPicker')}
          />
        ) : null}
        <FieldInput
          label={t('testCommands.groups.raw.ecu')}
          value={ecuText}
          onChangeText={setEcuText}
          error={ecuError}
          returnKeyType="next"
        />
        <FieldInput
          label={t('testCommands.groups.raw.payload')}
          value={payloadText}
          onChangeText={setPayloadText}
          error={payloadError}
          returnKeyType="send"
        />
      </View>
      <Button
        label={t('testCommands.groups.raw.send')}
        icon={PaperPlaneRight}
        variant="secondary"
        loading={runningId === 'raw'}
        disabled={disabled}
        onPress={handleSendPress}
      />
    </CardShell>
  );
};

export default RawCommandCard;
