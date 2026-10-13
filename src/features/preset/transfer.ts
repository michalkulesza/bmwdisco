import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import {
  exportPresets,
  importPresets,
  PresetImportError,
  PRESET_LIMITS,
  type Preset,
} from '@/domain';

export const exportFileName = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `bimmerdisco-${slug || 'preset'}.json`;
};

export const sharePresets = async (presets: readonly Preset[], fileName: string) => {
  if (!(await Sharing.isAvailableAsync())) return false;

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(exportPresets(presets));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });

  return true;
};

export const pickPresets = async (): Promise<Preset[] | undefined> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain'],
    copyToCacheDirectory: true,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return undefined;

  if ((asset.size ?? 0) > PRESET_LIMITS.maxFileBytes) throw new PresetImportError('tooLarge');

  return importPresets(await new File(asset.uri).text());
};
