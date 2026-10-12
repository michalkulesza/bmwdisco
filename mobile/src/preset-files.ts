import Storage from 'expo-sqlite/kv-store';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { LightingPreset, parsePresets, PRESET_LIMITS, serializePresets } from './presets';

const KEY = 'bimmerdisco.presets.v1';
export function loadPresets(): LightingPreset[] {
  const json = Storage.getItemSync(KEY);
  return json === null ? [] : parsePresets(json);
}
export function savePresets(presets: LightingPreset[]) { Storage.setItemSync(KEY, serializePresets(presets)); }
export async function importPresetFile(): Promise<LightingPreset[] | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size) > PRESET_LIMITS.fileBytes) throw new Error('Preset file is too large (maximum 1 MB)');
    return parsePresets(await file.text());
  } finally {
    // Only delete the picker-created cache copy, never the user's source document.
    if (file.uri.startsWith(`${Paths.cache.uri.replace(/\/$/, '')}/`)) {
      try { file.delete(); } catch { /* iOS may already have removed its cache copy. */ }
    }
  }
}
export async function exportPresetFile(presets: LightingPreset[]) {
  const json = serializePresets(presets);
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device');
  const filename = presets.length === 1 ? `bimmerdisco-${presets[0].id}.json` : 'bimmerdisco-presets.json';
  const file = new File(Paths.cache, filename);
  file.write(json);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Export lighting presets' });
}
