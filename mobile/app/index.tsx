import { useCallback, useEffect, useState } from 'react';
import { Button, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { Mode } from '../src/session';
import { profileLabel } from '../src/protocol/profiles';
import PresetRunList from '../src/home-ui/PresetRunList';
import SessionLog from '../src/home-ui/SessionLog';
import { danger } from '../src/theme';
import { forgetDevice, getRememberedDevice } from '../src/ble-device-store';
import { CONNECTION_DEFAULTS as defaults, useVehicle } from '../src/vehicle-context';

const colors = { text: '#F2F6FF', muted: '#9BAAC1', blue: '#79B6FF', card: '#121F33', border: '#24344D' };
const card = { backgroundColor: colors.card, borderRadius: 22, borderCurve: 'continuous' as const, padding: 20, gap: 16, borderWidth: 1, borderColor: colors.border };
const connectedCard = { ...card, backgroundColor: '#123A2E', borderColor: '#2F8A63' };
const label = { color: colors.muted, fontSize: 12, fontWeight: '600' as const, letterSpacing: 1.6 };
const modeLabels: Record<Mode, string> = { demo: 'Demo', enet: 'ENET', thor: 'THOR', icar: 'BLE' };
const field = { color: colors.text, backgroundColor: '#0A1424', borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, fontVariant: ['tabular-nums'] as ('tabular-nums')[] };

export default function Home() {
  const { state, session, mode, setMode, endpoint, setEndpoint } = useVehicle();
  const [shareError, setShareError] = useState<string | null>(null);
  const [rememberedName, setRememberedName] = useState<string | null>(null);
  const locked = state.connected || state.busy;
  const ready = state.connected && state.verified && !state.busy;
  const vehicleLabel = profileLabel(state.vehicle);
  const ecuName = state.vehicle?.ecu ?? 'ECU';
  const connectionCardStyle = state.connected ? connectedCard : card;

  useEffect(() => {
    if (mode !== 'icar' || state.busy) return;
    void getRememberedDevice().then(device => setRememberedName(device ? device.name || 'Unnamed' : null));
  }, [mode, state.busy, state.connected]);

  const handleForgetDevice = useCallback(async () => {
    await forgetDevice();
    setRememberedName(null);
  }, []);

  const handleExportLogs = useCallback(async () => {
    setShareError(null);
    try {
      await Share.share({ title: 'BimmerDisco diagnostic log', message: [
        `BimmerDisco · ${vehicleLabel}`,
        mode === 'demo' ? 'SIMULATED DEMO — no vehicle connection' : `Adapter: ${mode.toUpperCase()}`,
        `Status: ${state.status}`, `${ecuName} identity: ${state.identity ?? 'Not identified'}`, '', ...state.logs,
      ].join('\n') });
    } catch (error) { setShareError(error instanceof Error ? error.message : 'Could not share logs'); }
  }, [mode, state.identity, state.logs, state.status, vehicleLabel, ecuName]);

  return <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}>
    <View style={{ gap: 8 }}>
      <Text style={label}>{vehicleLabel}</Text>
      <Text style={{ color: colors.text, fontSize: 27, fontWeight: '700', letterSpacing: -0.7 }}>Lighting presets</Text>
      <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>Connect, identify the ECU, then run your light sequences.</Text>
    </View>

    <View style={connectionCardStyle}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={label}>01 / CONNECTION</Text>
        <View style={{ backgroundColor: state.connected ? '#183B36' : '#26334A', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: state.connected ? '#A1E7CD' : '#C1CCE0', fontSize: 11, fontWeight: '700' }}>{state.connected ? 'CONNECTED' : 'OFFLINE'}</Text>
        </View>
      </View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 6, backgroundColor: '#0A1424', padding: 5, borderRadius: 14 }}>
        {(['demo', 'enet', 'thor', 'icar'] as Mode[]).map(item => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: mode === item, disabled: locked }} disabled={locked} onPress={() => { setMode(item); setEndpoint(defaults[item]); }} style={({ pressed }) => ({ flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: mode === item ? '#264C7B' : 'transparent', opacity: pressed ? 0.65 : locked && mode !== item ? 0.45 : 1 })}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{modeLabels[item]}</Text>
        </Pressable>)}
      </View>
      {mode === 'demo' ? <View style={{ backgroundColor: '#19334D', borderRadius: 12, padding: 14, gap: 5 }}>
        <Text style={{ color: '#A7D5FF', fontSize: 15, fontWeight: '700' }}>Simulated · no vehicle connected</Text>
        <Text style={{ color: '#A7BCD5', lineHeight: 20, fontSize: 13 }}>Explore the full test flow. Demo actions never communicate with a car.</Text>
      </View> : mode === 'icar' ? <View style={{ gap: 8 }}>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>Pair nothing in iOS Settings — the app connects over Bluetooth LE to a Vgate iCar or generic BLE ELM327 adapter. Plug it into OBD, ignition on.</Text>
        {rememberedName && <Pressable accessibilityRole="button" accessibilityLabel={`Forget ${rememberedName}`} disabled={locked} hitSlop={12} onPress={() => void handleForgetDevice()} style={{ opacity: locked ? 0.45 : 1 }}>
          <Text style={{ color: colors.blue, fontSize: 13 }}>Forget {rememberedName}</Text>
        </Pressable>}
      </View> : <View style={{ gap: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{mode === 'enet' ? 'Connect your ENET Ethernet adapter. This IP is a candidate; enter the vehicle IP if different.' : 'Join your THOR adapter’s Wi-Fi, then verify its host and TCP port.'}</Text>
        <View style={{ gap: 7 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Host IPv4 address</Text>
          <TextInput accessibilityLabel="Host IPv4 address" style={field} value={endpoint.host} editable={!locked} onChangeText={host => setEndpoint(value => ({ ...value, host }))} keyboardType="decimal-pad" autoCorrect={false} autoCapitalize="none" selectTextOnFocus />
        </View>
        <View style={{ gap: 7 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>TCP port</Text>
          <TextInput accessibilityLabel="TCP port" style={field} value={endpoint.port} editable={!locked} onChangeText={port => setEndpoint(value => ({ ...value, port }))} keyboardType="number-pad" selectTextOnFocus />
        </View>
      </View>}
      <View style={{ backgroundColor: '#2566B4', borderRadius: 12, paddingVertical: 5, opacity: locked ? 0.45 : 1 }}>
        <Button title={state.busy && !state.connected ? 'Connecting…' : 'Connect & identify'} color="#FFFFFF" disabled={locked} onPress={() => void session.connect(mode, endpoint.host.trim(), Number(endpoint.port))} />
      </View>
      <Button title="Disconnect" color={danger} disabled={!state.connected && !state.busy} onPress={() => void session.disconnect()} />
      <View style={{ borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingVertical: 5 }}>
        <Button title={state.busy ? 'Stop & restore control' : 'Restore ECU control'} color="#FFCE96" disabled={!state.busy && !ready} onPress={() => void (state.busy ? session.stop() : session.restore())} />
      </View>
      <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 14 }}>{state.status}</Text>
      {state.identity && <Text selectable style={{ color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] }}>{ecuName} identity  {state.identity}{state.verified ? ' · verified' : ' · mismatch'}</Text>}
      {state.error && <Text selectable accessibilityRole="alert" style={{ color: '#FFB4AB', fontSize: 14, lineHeight: 21 }}>{state.error}</Text>}
    </View>

    <View style={card}>
      <Text style={label}>02 / LIGHTING PRESETS</Text>
      <PresetRunList />
      <Link href="/presets" style={{ color: colors.blue, fontSize: 17, paddingVertical: 12 }}>Manage lighting presets →</Link>
    </View>
    <View style={card}>
      <SessionLog logs={state.logs} onExport={handleExportLogs} />
      {shareError && <Text selectable accessibilityRole="alert" style={{ color: '#FFB4AB', fontSize: 13 }}>{shareError}</Text>}
    </View>
    <View style={{ gap: 4 }}>
      <Text style={{ color: '#70819C', fontSize: 12, lineHeight: 16, textAlign: 'center' }}>{vehicleLabel} · Prototype</Text>
      <Text style={{ color: '#70819C', fontSize: 12, lineHeight: 16, textAlign: 'center' }}>Kula daje fula</Text>
    </View>
  </ScrollView>;
}
