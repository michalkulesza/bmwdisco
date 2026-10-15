const READ_DATA = 0x22;
const TESTER_PRESENT = 0x3e;
const SESSION_CONTROL = 0x10;
const COMMUNICATION_CONTROL = 0x28;
const DEFAULT_SESSION = 0x01;
const ENABLE_RX_TX = 0x00;

export const requiresConfirmation = (payload: Uint8Array): boolean => {
  const [service, subFunction] = payload;
  if (service === READ_DATA || service === TESTER_PRESENT) return false;

  return !(service === SESSION_CONTROL && subFunction === DEFAULT_SESSION);
};

export const silencesCommunication = (payload: Uint8Array): boolean =>
  payload[0] === COMMUNICATION_CONTROL && payload[1] !== ENABLE_RX_TX;
