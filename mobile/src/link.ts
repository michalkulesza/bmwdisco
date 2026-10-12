export type Mode = 'demo' | 'enet' | 'thor';
export interface DiagnosticLink {
  open(): Promise<void>;
  request(payload: Uint8Array, address: number): Promise<Uint8Array>;
  close(): void;
}
export type LinkFactory = (mode: Mode, host: string, port: number,
  log: (message: string) => void, lost: (error: Error) => void) => DiagnosticLink;
export const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
