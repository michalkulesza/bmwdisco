export type UdsMatch = { kind: 'positive' } | { kind: 'pending'; code: 0x78 } |
  { kind: 'negative'; code: number } | { kind: 'unrelated' };

/** Caller must first check transport source/destination and serialize requests. */
export function matchUdsResponse(request: Uint8Array, response: Uint8Array): UdsMatch {
  const unrelated = { kind: 'unrelated' } as const;
  if (!request.length || !response.length) return unrelated;
  if (response[0] === 0x7f) {
    if (response.length !== 3 || response[1] !== request[0]) return unrelated;
    return response[2] === 0x78 ? { kind: 'pending', code: 0x78 } : { kind: 'negative', code: response[2] };
  }
  if (response[0] !== request[0] + 0x40) return unrelated;
  if (request[0] === 0x22) {
    if (request.length !== 3 || response.length < 4 || response[1] !== request[1] || response[2] !== request[2]) return unrelated;
  } else if (request[0] === 0x10) {
    if (request.length !== 2 || response.length < 2 || response[1] !== (request[1] & 0x7f)) return unrelated;
  } else if (request[0] === 0x2f) {
    if (request.length < 4 || response.length < 4 || response[1] !== request[1] ||
        response[2] !== request[2] || response[3] !== request[3]) return unrelated;
    // Remaining bytes are a DID-specific status record, not a standardized
    // echo of channel/state. Serialize requests and discard timed-out sockets.
  } else return unrelated;
  return { kind: 'positive' };
}
