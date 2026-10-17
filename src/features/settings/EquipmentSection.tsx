import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import type { DetectedCar } from '@/domain/registry/types';
import type { HeadlightType, VehicleFacts } from '@/domain/vehicle/types';
import { useSessionActions, useSessionPhase, useSessionSelector } from '@/session';
import { resolveEquipmentConflict, selectHeadlightType } from '@/stores/vehicle-facts';
import Button from '@/ui/Button';
import ListGroup from '@/ui/ListGroup';
import SectionHeader from '@/ui/SectionHeader';
import SegmentedControl from '@/ui/SegmentedControl';
import Text from '@/ui/Text';

const HEADLIGHT_TYPES: readonly HeadlightType[] = ['unknown', 'halogen', 'xenon', 'led'];
const UNKNOWN_FACTS: VehicleFacts = { headlightType: 'unknown' };
const NO_VALIDATIONS = [] as const;

const EquipmentSection = ({ car }: { car: DetectedCar }) => {
  const { t } = useTranslation();
  const phase = useSessionPhase();
  const safeForEdit = useSessionSelector(
    (snapshot) =>
      !snapshot.context.testActive &&
      !snapshot.context.activeToggleId &&
      !snapshot.context.lightsMayBeOn &&
      !snapshot.context.restoreRequested,
  );
  const { setVehicleFacts } = useSessionActions();
  const facts = car.actionContext?.facts ?? UNKNOWN_FACTS;
  const validations = car.actionContext?.validations ?? NO_VALIDATIONS;
  const ready = phase === 'ready' && safeForEdit;
  const options = HEADLIGHT_TYPES.map((value) => ({ value, label: t(`equipment.${value}`) }));
  const handleChange = useCallback(
    (value: HeadlightType) => {
      if (!ready) return;
      setVehicleFacts(selectHeadlightType(facts, value), validations);
    },
    [facts, ready, setVehicleFacts, validations],
  );
  const handleResolve = useCallback(() => {
    if (!ready || facts.headlightType === 'unknown') return;
    Alert.alert(
      t('equipment.confirmTitle'),
      t('equipment.confirmMessage', { type: t(`equipment.${facts.headlightType}`) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('equipment.confirmSelection'),
          onPress: () => setVehicleFacts(resolveEquipmentConflict(facts), validations),
        },
      ],
    );
  }, [facts, ready, setVehicleFacts, t, validations]);

  return (
    <View className="gap-3">
      <SectionHeader title={t('equipment.title')} />
      <ListGroup>
        <View className="gap-3 p-4">
          <Text variant="bodyMedium">{t('equipment.headlightType')}</Text>
          {ready ? (
            <SegmentedControl
              options={options}
              value={facts.headlightType}
              onChange={handleChange}
              accessibilityLabel={t('equipment.headlightType')}
            />
          ) : (
            <Text variant="small" tone="muted">
              {t('equipment.readyRequired')}
            </Text>
          )}
          <Text variant="small" tone="muted">
            {t('equipment.explanation')}
          </Text>
          {facts.conflict ? (
            <Text variant="small" tone="destructive">
              {t('equipment.conflict')}
            </Text>
          ) : null}
          {facts.conflict && ready && facts.headlightType !== 'unknown' ? (
            <Button label={t('equipment.resolveConflict')} onPress={handleResolve} />
          ) : null}
        </View>
      </ListGroup>
    </View>
  );
};

export default EquipmentSection;
