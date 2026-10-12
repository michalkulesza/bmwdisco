# Vgate iCar Bluetooth (BLE / ELM327) adapter

Goal: add a fourth adapter mode `icar` next to Demo / ENET / THOR, matching how BimmerLight drives
the Vgate iCar. Evidence: `analysis/vgate-findings.md` (static analysis of EdiabasKit; unverified on hardware).

## Transport

- BLE via `react-native-ble-plx` (+ its Expo config plugin, `bluetoothAlwaysPermission` text in app.json).
  Requires a dev build. If it fails to build/link on RN 0.86 New Architecture, fall back to `react-native-ble-manager`.
- Scan for peripherals advertising `18F0` / `FFE0` / `E7810A71-73AE-499D-8C15-FAA9AEF0C3F2` / `BEF8D6C9-…`
  or whose name contains `iCar` / `Vgate` (case-insensitive). Connect to the first match within ~10 s
  (no device picker in v1; log the chosen name/id). Write + notify characteristic
  `BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F` (notify fallback `2AF0`).
- Serial line protocol: send `CMD\r`, accumulate notified ASCII until `>`; one command in flight.
  Write in chunks ≤ 20 bytes unless a larger MTU is negotiated.

## ELM init (in order, each must return without `?`/`ERROR`)

`ATZ, ATE0, ATS0, ATL0, ATH1, ATAL, ATCAF0, ATPBE101, ATSPB, ATBI, ATAT2, ATFCSH6F1, ATSH6F1`

Per target ECU (only when it changes, then wait ~50 ms):
`ATFCSD<ecu>30FF08`, `ATFCSM1`, `ATCRA6<ecu>`, `ATCEA<ecu>`
(`<ecu>` two hex digits, e.g. `40`, `72`).

## BMW D-CAN ISO-TP (app-side, since CAF0)

- Request CAN ID 0x6F1, data byte 0 = target ECU (extended addressing), 0xAA padding to 8 bytes.
- Single frame: payload ≤ 6 bytes → `[ecu, 0x0L, …payload]`.
- Multi frame (e.g. F32 `2E D5 42 …` = 7 bytes): first frame `[ecu, 0x1L_hi, L_lo, 5 bytes]`, wait for
  the ECU's flow control (`6<ecu>` with `F1 30 BS ST`), then consecutive frames `[ecu, 0x2n, 6 bytes]`
  honouring BS/STmin.
- Responses: lines `6<ecu> F1 <PCI> …` (headers on, spaces off). Parse SF; reassemble FF+CF (ELM sends
  our flow control per `ATFCSM1`/`ATFCSD`). Ignore `NO DATA` lines while waiting; `CAN ERROR`,
  `BUFFER FULL`, `?` → error.
- Pass reassembled UDS payloads through `matchUdsResponse` exactly like `WireLink` (0x78 pending extends,
  overall deadline, single in-flight request, timeout invalidates link).

## Code

- `Mode` gains `'icar'`; `LinkFactory` creates `ElmBleLink` for it (lazy `require`, like `NativeLink`).
- Put pure parts in `src/protocol/elm.ts` (AT command list, per-ECU commands, ISO-TP frame builder,
  response line parser/reassembler) — fully unit-tested without BLE. `src/elm-ble-link.ts` holds the BLE glue.
- Home: 4th segment "iCar" with a short note ("Pair nothing in iOS Settings — the app connects over
  Bluetooth LE. Plug the iCar into OBD, ignition on."); no host/port fields for it.
- Session/auto-detect/presets unchanged.

## Tests

Frame builder (SF, FF/CF incl. 7-byte D542 write), line parser (headers, NO DATA, errors, `>`),
multi-frame reassembly, per-ECU command switching only on change, ElmBleLink request flow against a fake
BLE transport (init order, address switch 0x40→0x72, pending 0x78, timeout).
