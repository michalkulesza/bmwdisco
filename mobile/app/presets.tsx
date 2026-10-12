import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Button, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Stack, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { ElementId, LIGHT_ELEMENTS, LightingPreset, mergePresets, newPresetId, PRESET_LIMITS, PresetStep, validatePreset } from '../src/presets';
import { exportPresetFile, importPresetFile, loadPresets, savePresets } from '../src/preset-files';
import { unsupportedElements } from '../src/protocol/profiles';
import { VehicleSession } from '../src/session';
import { useVehicle } from '../src/vehicle-context';

const c = { text: '#F2F6FF', muted: '#9BAAC1', blue: '#79B6FF', card: '#121F33', border: '#24344D', amber: '#FFCE96' };
const card = { backgroundColor: c.card, borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: c.border };
const field = { color: c.text, backgroundColor: '#0A1424', borderRadius: 12, padding: 14, fontSize: 17, borderColor: c.border, borderWidth: 1 };
const row = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: 8 };
function Action({ title, onPress, disabled = false, danger = false }: { title: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
      backgroundColor: danger ? '#492932' : '#1C3555', opacity: disabled ? 0.4 : pressed ? 0.65 : 1 })}>
    <Text style={{ color: danger ? '#FFB4AB' : c.blue, fontWeight: '600' }}>{title}</Text>
  </Pressable>;
}
function failure(error: unknown) { return error instanceof Error ? error.message : String(error); }
function Lights({ active }: { active: ElementId[] }) {
  return <View style={row}>{LIGHT_ELEMENTS.map(light => <View key={light.id} style={{ flex: 1, minWidth: 115, borderRadius: 14, padding: 16, gap: 8,
    backgroundColor: active.includes(light.id) ? '#F3AB42' : '#0A1424' }}>
    <Text style={{ color: active.includes(light.id) ? '#261A09' : c.muted, fontSize: 25 }}>{light.side === 'left' ? '↖' : '↗'}</Text>
    <Text style={{ color: active.includes(light.id) ? '#261A09' : c.muted }}>Front {light.side} · {active.includes(light.id) ? 'On' : 'Off'}</Text>
  </View>)}</View>;
}

export default function PresetsScreen() {
  const { session, state, mode } = useVehicle();
  const navigation = useNavigation();
  const [presets, setPresets] = useState<LightingPreset[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<LightingPreset | null>(null);
  const [baseline, setBaseline] = useState('');
  const [fileBusy, setFileBusy] = useState(false);
  const fileLock = useRef(false);
  const playLock = useRef(false);
  const [, redrawPreview] = useState(0);
  const previewRef = useRef<VehicleSession | null>(null);
  if (!previewRef.current) previewRef.current = new VehicleSession(() => redrawPreview(n => n + 1));
  const preview = previewRef.current;
  const previewBusy = preview.state.busy;
  const busy = state.busy || previewBusy || fileBusy;
  const dirty = draft !== null && JSON.stringify(draft) !== baseline;
  const progress = preview.state.presetProgress ?? state.presetProgress;
  const running = previewBusy || !!state.presetProgress;
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    try { setPresets(loadPresets()); setLoaded(true); } catch (e) { setError(`Could not load presets: ${failure(e)}. Stored data has been preserved.`); }
    const subscription = AppState.addEventListener('change', value => { if (value !== 'active') void preview.stop(); });
    return () => { subscription.remove(); void preview.disconnect(); };
  }, [preview]);
  usePreventRemove(dirty || running, ({ data }) => {
    Alert.alert(running ? 'Stop playback and leave?' : 'Discard unsaved changes?', 'Saved presets will be kept.', [
      { text: 'Stay', style: 'cancel' },
      { text: running ? 'Stop & leave' : 'Discard', style: 'destructive', onPress: () => {
        void Promise.all([session.stop(), preview.stop()]).then(() => navigation.dispatch(data.action));
      } },
    ]);
  });

  function persist(next: LightingPreset[]) {
    savePresets(next); setPresets(next);
  }
  function edit(preset?: LightingPreset) {
    const next: LightingPreset = preset ? JSON.parse(JSON.stringify(preset)) : { id: newPresetId(), name: 'New preset', steps: [] };
    setBaseline(preset ? JSON.stringify(next) : ''); setDraft(next); setError(null); setNotice(null);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }
  function closeEditor() {
    if (busy) return;
    if (dirty) Alert.alert('Discard changes?', 'Your saved preset will be kept.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => setDraft(null) },
    ]); else setDraft(null);
  }
  function save() {
    if (!draft) return;
    try {
      const validated = validatePreset(draft);
      persist(presets.some(p => p.id === validated.id) ? presets.map(p => p.id === validated.id ? validated : p) : [...presets, validated]);
      setDraft(validated); setBaseline(JSON.stringify(validated)); setError(null); setNotice('Preset saved on this iPhone.');
    } catch (e) { setError(failure(e)); }
  }
  function updateStep(index: number, step: PresetStep) {
    setDraft(value => value && ({ ...value, steps: value.steps.map((old, i) => i === index ? step : old) }));
    setNotice(null);
  }
  function move(index: number, offset: number) {
    setDraft(value => {
      if (!value) return value;
      const steps = [...value.steps];
      [steps[index], steps[index + offset]] = [steps[index + offset], steps[index]];
      return { ...value, steps };
    });
  }
  async function files(action: () => Promise<void>) {
    if (fileLock.current) return;
    fileLock.current = true; setFileBusy(true); setError(null); setNotice(null);
    try { await action(); } catch (e) { setError(failure(e)); } finally { fileLock.current = false; setFileBusy(false); }
  }
  async function play(preset: LightingPreset, demo: boolean) {
    if (busy || playLock.current) return;
    playLock.current = true; setError(null); setNotice(null);
    try {
      const validated = validatePreset(preset);
      if (demo) {
        await preview.connect('demo', '', 0);
        if (preview.state.verified) await preview.playPreset(validated);
        if (preview.state.error) setError(preview.state.error);
        else setNotice('Demo finished. No vehicle commands were sent.');
        await preview.disconnect();
      } else await session.playPreset(validated);
    } catch (e) { setError(failure(e)); } finally { playLock.current = false; }
  }
  function playback(preset: LightingPreset) {
    const skipped = state.vehicle ? unsupportedElements(state.vehicle, preset) : [];
    const skippedLabels = skipped.map(id => LIGHT_ELEMENTS.find(light => light.id === id)!.label.toLowerCase()).join(', ');
    return <View style={{ gap: 8 }}><View style={row}>
      <Action title="Preview in Demo" disabled={busy} onPress={() => void play(preset, true)} />
      <Action title={mode === 'demo' ? 'Run on Demo connection' : 'Run on car'} disabled={busy || !state.connected || !state.verified} onPress={() => void play(preset, false)} />
    </View>
    {skipped.length > 0 && <Text style={{ color: c.amber, fontSize: 13 }}>Not supported on {state.vehicle!.chassis}, will be skipped: {skippedLabels}.</Text>}
    </View>;
  }

  return <ScrollView ref={scroll} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
    contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 18 }}>
    <Stack.Screen options={{ title: draft ? 'Edit preset' : 'Lighting presets', gestureEnabled: !draft,
      headerLeft: draft ? () => <Button title="Presets" color={c.blue} disabled={busy} onPress={closeEditor} /> : undefined }} />
    <Text style={{ color: c.muted, lineHeight: 21 }}>{draft ? 'Light blocks change the selected indicators. Delay blocks hold the current state before the next block.' : 'Your sequences, saved on this iPhone. Build once, preview, then play.'}</Text>
    {error && <Text selectable accessibilityRole="alert" style={{ color: '#FFB4AB', lineHeight: 21 }}>{error}</Text>}
    {notice && <Text selectable accessibilityLiveRegion="polite" style={{ color: '#A1E7CD' }}>{notice}</Text>}
    <View style={card}>
      <Text style={{ color: c.text, fontWeight: '600' }}>{previewBusy ? 'Demo preview · no vehicle commands' : `${mode.toUpperCase()} · ${state.status}`}</Text>
      {progress && <>
        <Text style={{ color: c.amber }}>{progress.name} · block {progress.index + 1} of {progress.total}</Text>
        <Lights active={progress.lights} />
      </>}
      {state.error && <Text selectable style={{ color: '#FFB4AB' }}>{state.error}</Text>}
      {running || state.busy ? <Action title="Stop & restore control" danger onPress={() => { void session.stop(); void preview.stop(); }} /> :
        <Text style={{ color: c.muted, lineHeight: 20 }}>Runs once, then restores ECU control. To run on the car, connect and identify it on the home screen first.</Text>}
    </View>
    {!draft ? <>
      <View style={row}>
        <Action title="＋ New preset" disabled={!loaded || busy || presets.length >= PRESET_LIMITS.presets} onPress={() => edit()} />
        <Action title="Import JSON" disabled={!loaded || busy} onPress={() => void files(async () => {
          const incoming = await importPresetFile();
          if (incoming) { persist(mergePresets(presets, incoming)); setNotice(`Imported ${incoming.length} preset${incoming.length === 1 ? '' : 's'}.`); }
        })} />
        <Action title="Export all" disabled={!loaded || busy || !presets.length} onPress={() => void files(() => exportPresetFile(presets))} />
      </View>
      {loaded && !presets.length && <View style={card}>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '600' }}>Your first light sequence</Text>
        <Text style={{ color: c.muted, lineHeight: 22 }}>Start with a light block, add a delay, then switch it off. Or try the alternating-indicators example.</Text>
        <Action title="Use alternating example" disabled={busy} onPress={() => edit({ id: newPresetId(), name: 'Alternating indicators', steps: [
          { type: 'set', elements: ['frontLeftIndicator'], state: 'on' }, { type: 'wait', durationMs: 500 },
          { type: 'set', elements: ['frontLeftIndicator'], state: 'off' }, { type: 'set', elements: ['frontRightIndicator'], state: 'on' },
          { type: 'wait', durationMs: 500 }, { type: 'set', elements: ['frontRightIndicator'], state: 'off' },
        ] })} />
      </View>}
      {presets.map(preset => <View key={preset.id} style={card}>
        <Text style={{ color: c.text, fontSize: 21, fontWeight: '600' }}>{preset.name}</Text>
        <Text style={{ color: c.muted }}>{preset.steps.length} blocks · {(preset.steps.reduce((sum, step) => sum + (step.type === 'wait' ? step.durationMs : 0), 0) / 1000).toFixed(2)} s of delays</Text>
        {playback(preset)}
        <View style={row}>
          <Action title="Edit" disabled={busy} onPress={() => edit(preset)} />
          <Action title="Duplicate" disabled={busy || presets.length >= PRESET_LIMITS.presets} onPress={() => {
            try { persist([...presets, { ...preset, id: newPresetId(), name: `${preset.name.slice(0, 73)} (copy)` }]); } catch (e) { setError(failure(e)); }
          }} />
          <Action title="Export" disabled={busy} onPress={() => void files(() => exportPresetFile([preset]))} />
          <Action title="Delete" danger disabled={busy} onPress={() => Alert.alert(`Delete “${preset.name}”?`, 'Export it first if you want to keep a copy.', [
            { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {
              try { persist(presets.filter(p => p.id !== preset.id)); } catch (e) { setError(failure(e)); }
            } },
          ])} />
        </View>
      </View>)}
    </> : <>
      <View style={card}>
        <Text style={{ color: c.muted }}>PRESET NAME{dirty ? ' · Unsaved' : ''}</Text>
        <TextInput accessibilityLabel="Preset name" value={draft.name} editable={!busy} maxLength={80} style={field} onChangeText={name => setDraft({ ...draft, name })} />
        <View style={row}>
          <Action title="Save preset" disabled={!loaded || busy} onPress={save} />
          <Action title="Export JSON" disabled={busy} onPress={() => void files(() => exportPresetFile([validatePreset(draft)]))} />
        </View>
        {playback(draft)}
      </View>
      {draft.steps.map((step, index) => <View key={index} style={{ ...card, borderColor: progress?.index === index ? c.amber : c.border }}>
        <View style={{ ...row, justifyContent: 'space-between' }}>
          <Text style={{ color: step.type === 'set' ? c.blue : c.amber, fontWeight: '700' }}>{String(index + 1).padStart(2, '0')} / {step.type === 'set' ? 'LIGHT STATE' : 'DELAY'}</Text>
          <Text style={{ color: c.muted }}>{step.type === 'set' ? step.state.toUpperCase() : `${step.durationMs || 0} ms`}</Text>
        </View>
        {step.type === 'set' ? <>
          {LIGHT_ELEMENTS.map(light => <Pressable key={light.id} accessibilityRole="checkbox" accessibilityLabel={light.label}
            accessibilityState={{ checked: step.elements.includes(light.id), disabled: busy }} disabled={busy}
            onPress={() => updateStep(index, { ...step, elements: step.elements.includes(light.id) ? step.elements.filter(id => id !== light.id) : [...step.elements, light.id] })}
            style={{ ...row, minHeight: 44 }}>
            <Text style={{ color: step.elements.includes(light.id) ? c.blue : c.muted, fontSize: 22 }}>{step.elements.includes(light.id) ? '☑' : '☐'}</Text>
            <Text style={{ color: c.text, flex: 1 }}>{light.label}</Text>
          </Pressable>)}
          <View style={{ ...row, justifyContent: 'space-between' }}>
            <Text style={{ color: c.text }}>Set selected lights {step.state}</Text>
            <Switch accessibilityLabel={`Block ${index + 1} lights on`} disabled={busy} value={step.state === 'on'} onValueChange={on => updateStep(index, { ...step, state: on ? 'on' : 'off' })} />
          </View>
        </> : <>
          <Text style={{ color: c.muted }}>Duration in milliseconds · 50–2,000</Text>
          <TextInput accessibilityLabel={`Block ${index + 1} delay in milliseconds`} value={Number.isNaN(step.durationMs) ? '' : String(step.durationMs)} editable={!busy}
            keyboardType="number-pad" selectTextOnFocus maxLength={5} style={field} onChangeText={text => updateStep(index, { type: 'wait', durationMs: text === '' ? NaN : Number(text) })} />
          <View style={row}>{[100, 250, 500, 1000, 2000].map(durationMs => <Action key={durationMs} title={`${durationMs}`} disabled={busy} onPress={() => updateStep(index, { type: 'wait', durationMs })} />)}</View>
        </>}
        <View style={row}>
          <Action title="Move up" disabled={busy || index === 0} onPress={() => move(index, -1)} />
          <Action title="Move down" disabled={busy || index === draft.steps.length - 1} onPress={() => move(index, 1)} />
          <Action title="Remove" disabled={busy} danger onPress={() => setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) })} />
        </View>
      </View>)}
      <View style={row}>
        <Action title="＋ Light block" disabled={busy || draft.steps.length >= PRESET_LIMITS.steps} onPress={() => setDraft({ ...draft, steps: [...draft.steps, { type: 'set', elements: ['frontLeftIndicator'], state: 'on' }] })} />
        <Action title="＋ Delay" disabled={busy || draft.steps.length >= PRESET_LIMITS.steps} onPress={() => setDraft({ ...draft, steps: [...draft.steps, { type: 'wait', durationMs: 500 }] })} />
      </View>
      <Text style={{ color: c.muted, lineHeight: 20 }}>Up to 200 blocks and 60 seconds of delays. Commands take additional time. Multiple lights in a block are set sequentially.</Text>
      <Action title="Save preset" disabled={!loaded || busy} onPress={save} />
    </>}
  </ScrollView>;
}
