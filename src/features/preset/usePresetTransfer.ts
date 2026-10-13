import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { PresetImportError, type Preset } from '@/domain';
import { usePresetsStore } from '@/stores/presets';
import { translateKey } from '@/ui/tile/helpers';
import { useToast } from '@/ui/Toast';

import { exportFileName, pickPresets, sharePresets } from './transfer';

export const usePresetTransfer = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const importMany = usePresetsStore((state) => state.importMany);

  const handleImport = useCallback(async () => {
    try {
      const presets = await pickPresets();
      if (!presets) return;

      const count = importMany(presets);
      const title =
        count === 0 ? t('preset.transfer.noRoom') : t('preset.transfer.imported', { count });
      toast.show({ title, tone: count === 0 ? 'error' : 'success' });
    } catch (error) {
      const code = error instanceof PresetImportError ? error.code : undefined;
      const description = code ? translateKey(t, `preset.transfer.errors.${code}`) : undefined;
      toast.show({ title: t('preset.transfer.importFailed'), description, tone: 'error' });
    }
  }, [importMany, t, toast]);

  const handleExport = useCallback(
    async (preset: Preset) => {
      try {
        const shared = await sharePresets([preset], exportFileName(preset.name));
        if (!shared) toast.show({ title: t('preset.transfer.shareUnavailable'), tone: 'error' });
      } catch {
        toast.show({ title: t('preset.transfer.exportFailed'), tone: 'error' });
      }
    },
    [t, toast],
  );

  return { importFromFile: handleImport, exportPreset: handleExport };
};
