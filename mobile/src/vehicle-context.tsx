import { createContext, ReactNode, use, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Mode, SessionState, VehicleSession } from './session';

export const CONNECTION_DEFAULTS: Record<Mode, { host: string; port: string }> = {
  demo: { host: '', port: '6801' }, enet: { host: '169.254.250.250', port: '6801' }, thor: { host: '192.168.4.1', port: '23' },
  icar: { host: '', port: '' },
};
const INITIAL: SessionState = { status: 'Disconnected', connected: false, verified: false, busy: false, logs: [], identity: null, vehicle: null, error: null };
function useVehicleState() {
  const [state, setState] = useState(INITIAL);
  const [mode, setMode] = useState<Mode>('demo');
  const [endpoint, setEndpoint] = useState(CONNECTION_DEFAULTS.demo);
  const ref = useRef<VehicleSession | null>(null);
  if (!ref.current) ref.current = new VehicleSession(setState);
  const session = ref.current;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => {
      if (value !== 'active' && session.state.verified) void session.stop();
    });
    return () => { subscription.remove(); void session.disconnect(); };
  }, [session]);
  return { state, session, mode, setMode, endpoint, setEndpoint };
}
const VehicleContext = createContext<ReturnType<typeof useVehicleState> | null>(null);
export function VehicleProvider({ children }: { children: ReactNode }) {
  return <VehicleContext.Provider value={useVehicleState()}>{children}</VehicleContext.Provider>;
}
export function useVehicle() {
  const value = use(VehicleContext);
  if (!value) throw new Error('VehicleProvider missing');
  return value;
}
