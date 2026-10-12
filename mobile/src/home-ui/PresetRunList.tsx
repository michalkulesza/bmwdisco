import { memo, useCallback, useState } from 'react';
import { PlatformColor, Pressable, PressableStateCallbackType, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LightingPreset, presetSummary } from '../presets';
import { loadPresets } from '../preset-files';
import { useVehicle } from '../vehicle-context';

const colors = { text: '#F2F6FF', muted: '#9BAAC1', error: '#FFB4AB', block: '#0A1424', border: '#24344D' };
const block = { backgroundColor: colors.block, borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: colors.border };

const PresetRunList = () => {
  const { state, session, mode } = useVehicle();
  const [presets, setPresets] = useState<LightingPreset[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const ready = state.connected && state.verified && !state.busy;
  const target = mode === 'demo' ? 'Demo' : state.vehicle?.chassis ?? 'car';

  useFocusEffect(useCallback(() => {
    try { setPresets(loadPresets()); setLoadError(null); }
    catch (error) { setLoadError(`Could not load presets: ${error instanceof Error ? error.message : error}`); }
  }, []));

  const handleRun = useCallback((preset: LightingPreset) => {
    void session.playPreset(preset);
  }, [session]);

  const getRunStyle = useCallback(({ pressed }: PressableStateCallbackType) => ({
    minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 12, paddingVertical: 12,
    backgroundColor: PlatformColor('systemGreen'), opacity: !ready ? 0.4 : pressed ? 0.65 : 1,
  }), [ready]);

  if (loadError) return <Text selectable accessibilityRole="alert" style={{ color: colors.error, lineHeight: 21 }}>{loadError}</Text>;
  if (!presets.length) return <Text style={{ color: colors.muted, lineHeight: 21 }}>No presets yet. Build your first sequence below.</Text>;

  return <View style={{ gap: 12 }}>
    {presets.map(preset => <View key={preset.id} style={block}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: '600' }}>{preset.name}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{presetSummary(preset)}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Run ${preset.name} on ${target}`} accessibilityState={{ disabled: !ready }}
        disabled={!ready} onPress={() => handleRun(preset)} style={getRunStyle}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 21, fontWeight: '600' }}>Run on {target}</Text>
      </Pressable>
    </View>)}
    {!state.verified && <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>Connect and identify a supported vehicle to run presets.</Text>}
  </View>;
};

export default memo(PresetRunList);
