import { BleAdvert } from './protocol/elm';

export interface PickerRequest { candidates: BleAdvert[]; resolve: (id: string | null) => void }

let current: PickerRequest | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export const getPickerRequest = () => current;

export function subscribePicker(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function requestDeviceChoice(candidates: BleAdvert[]): Promise<string | null> {
  current?.resolve(null);
  return new Promise(resolve => {
    current = { candidates, resolve };
    notify();
  });
}

export function settleDeviceChoice(id: string | null) {
  const request = current;
  if (!request) return;
  current = null;
  notify();
  request.resolve(id);
}
