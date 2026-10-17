import { useLocalSearchParams, useRouter } from 'expo-router';
import { CopyIcon } from 'phosphor-react-native/src/icons/Copy';
import { ExportIcon } from 'phosphor-react-native/src/icons/Export';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadEffects } from '@/data/generated';
import { PRESET_LIMITS } from '@/domain';
import { usePresetTransfer } from '@/features/preset/usePresetTransfer';
import { useSessionSelector } from '@/session';
import { useFavouritesStore } from '@/stores/favourites';
import { usePresetsStore, type PresetSaveResult } from '@/stores/presets';
import Button from '@/ui/Button';
import EmptyState from '@/ui/EmptyState';
import ListGroup from '@/ui/ListGroup';
import { effectItem, presetItem } from '@/ui/tile/items';
import type { TileItem } from '@/ui/tile/types';
import { useToast } from '@/ui/Toast';

import { buildEffectPreset, findSubject, fitName, type MenuSubject } from './helpers';
import MenuHeader from './MenuHeader';
import MenuRow from './MenuRow';

interface TileMenuContentProps {
  subject: MenuSubject;
}

const getSubjectId = (subject: MenuSubject) =>
  subject.kind === 'preset' ? subject.preset.id : subject.effect.id;

const TileMenuContent = ({ subject }: TileMenuContentProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { exportPreset } = usePresetTransfer();
  const car = useSessionSelector((snapshot) => snapshot.context.car);
  const addPreset = usePresetsStore((state) => state.add);
  const duplicatePreset = usePresetsStore((state) => state.duplicate);
  const removePreset = usePresetsStore((state) => state.remove);
  const favouriteIds = useFavouritesStore((state) => state.ids);
  const addFavourite = useFavouritesStore((state) => state.add);
  const removeFavourite = useFavouritesStore((state) => state.remove);

  const id = getSubjectId(subject);
  const isFavourite = favouriteIds.includes(id);
  const item: TileItem = useMemo(
    () =>
      subject.kind === 'preset'
        ? presetItem(subject.preset, t, car)
        : effectItem(subject.effect, t, car),
    [subject, t, car],
  );

  const reportSaveResult = useCallback(
    (result: PresetSaveResult, name: string) => {
      if (result.ok) {
        toast.show({ title: t('tile.menu.duplicated', { name }), tone: 'success' });
        router.back();

        return;
      }

      const title =
        result.reason === 'limit'
          ? t('tile.menu.limitReached', { max: PRESET_LIMITS.maxPresets })
          : t('tile.menu.duplicateFailed');
      toast.show({ title, tone: 'error' });
    },
    [router, t, toast],
  );

  const handleFavouritePress = useCallback(() => {
    if (isFavourite) removeFavourite(id);
    else addFavourite(id);
    router.back();
  }, [addFavourite, id, isFavourite, removeFavourite, router]);

  const handleEditPress = useCallback(() => {
    router.replace({ pathname: '/preset/[id]', params: { id } });
  }, [id, router]);

  const handleDuplicatePress = useCallback(() => {
    if (subject.kind === 'preset') {
      const name = fitName(t('tile.menu.copyName', { name: subject.preset.name }));
      reportSaveResult(duplicatePreset(subject.preset.id, name), name);

      return;
    }

    try {
      const preset = buildEffectPreset(subject.effect, t);
      reportSaveResult(addPreset(preset), preset.name);
    } catch {
      toast.show({ title: t('tile.menu.duplicateFailed'), tone: 'error' });
    }
  }, [addPreset, duplicatePreset, reportSaveResult, subject, t, toast]);

  const handleExportPress = useCallback(() => {
    if (subject.kind === 'preset') void exportPreset(subject.preset);
  }, [exportPreset, subject]);

  const handleDeleteConfirmed = useCallback(() => {
    removePreset(id);
    removeFavourite(id);
    router.back();
  }, [id, removeFavourite, removePreset, router]);

  const handleDeletePress = useCallback(() => {
    Alert.alert(t('tile.menu.deleteTitle', { name: item.name }), t('tile.menu.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('tile.menu.delete'), style: 'destructive', onPress: handleDeleteConfirmed },
    ]);
  }, [handleDeleteConfirmed, item.name, t]);

  const handleClosePress = useCallback(() => router.back(), [router]);

  const favouriteLabel = isFavourite ? t('tile.menu.removeFavourite') : t('tile.menu.addFavourite');

  return (
    <View className="flex-1 gap-4 px-4 pt-6" style={{ paddingBottom: insets.bottom + 16 }}>
      <MenuHeader item={item} />
      <ListGroup>
        <MenuRow icon={StarIcon} label={favouriteLabel} onPress={handleFavouritePress} />
        {subject.kind === 'preset' ? (
          <MenuRow icon={PencilSimpleIcon} label={t('tile.menu.edit')} onPress={handleEditPress} />
        ) : null}
        <MenuRow icon={CopyIcon} label={t('tile.menu.duplicate')} onPress={handleDuplicatePress} />
        {subject.kind === 'preset' ? (
          <MenuRow icon={ExportIcon} label={t('tile.menu.export')} onPress={handleExportPress} />
        ) : null}
        {subject.kind === 'preset' ? (
          <MenuRow
            icon={TrashIcon}
            label={t('tile.menu.delete')}
            onPress={handleDeletePress}
            destructive
          />
        ) : null}
      </ListGroup>
      <Button label={t('common.cancel')} onPress={handleClosePress} variant="secondary" />
    </View>
  );
};

const TileMenuSheet = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const presets = usePresetsStore((state) => state.presets);
  const effects = useMemo(() => loadEffects(), []);
  const subject = useMemo(() => findSubject(id, presets, effects), [id, presets, effects]);

  const handleClosePress = useCallback(() => router.back(), [router]);

  if (!subject) {
    return (
      <EmptyState
        icon={WarningCircleIcon}
        title={t('tile.menu.notFound')}
        actionLabel={t('common.close')}
        onActionPress={handleClosePress}
      />
    );
  }

  return <TileMenuContent subject={subject} />;
};

export default TileMenuSheet;
