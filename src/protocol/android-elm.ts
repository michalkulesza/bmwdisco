import { ecuHex } from './elm-at';

// Android adapter's default ELM D-CAN mode 2. See docs/android-connection-notes.md.
// ATCEA inserts the target byte; CAF1 inserts the single-frame PCI.
export const ANDROID_ELM_INIT = [
  'ATD',
  'ATE0',
  'ATS0',
  'ATL0',
  'ATAL',
  'ATAT0',
  'ATH1',
  'ATPB C101',
  'ATCRA 612',
  'ATSH 6F1',
  'ATFC SH6F1',
  'ATFCSD 12300002',
  'ATFC SM1',
  'ATCEA 12',
  'ATCM 600',
  'ATCF 600',
  'ATSP B',
  'ATBI',
  'ATAT0',
] as const;

export const androidEcuCommands = (ecu: number): string[] => {
  const id = ecuHex(ecu);
  return [`ATCEA ${id}`, `ATCRA 6${id}`, `ATFCSD ${id}300002`];
};
