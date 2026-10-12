# BimmerLight 3.8: connection analysis and F32 proof-of-concept scope

Analysis date: 2026-10-12. All vehicle behavior below is inferred from the supplied
app and its bundled data unless explicitly identified as an external reference.
No vehicle was connected, no car commands were transmitted, and the original
app directory was not modified.

## Result

There is enough recovered information to implement a small local diagnostic
client that tests two candidate lighting commands on a BMW F32. The proposed
commands are **front left indicator** and **front right indicator**, each with
on/off support. Their source is the app's `FEM_20` mapping, not a guessed CAN ID.
The actual car must identify its module before these commands are enabled.

An offline demonstration is already available:

```powershell
python analysis/f32_packets.py --side left
python analysis/f32_packets.py --side right --json
```

This generates UDS payloads and both transport representations. It opens no
connections. It is the first reproducible piece of the proof of concept;
a working, vehicle-tested client is still to be implemented.

## What was supplied

- Extracted **iOS** application: `com.bimmerlight.prod-3.8-eeveedecrypter/Payload/BimmerLight.app`.
- Bundle ID `com.bimmerlight.prod`, version `3.8`, build `54`, ARM64 Mach-O binaries.
- `BimmerLight` contains the application/UI; `EdiabasKit.framework/EdiabasKit`
  contains diagnostic, transport, action execution and resource-loading logic.
- The application and EdiabasKit Mach-O encryption commands both have `cryptid=0`.
  Their code is available for static examination.
- The 116 `.bimmerlight` data resources **are separately encrypted**. They were
  successfully authenticated and decoded into `analysis/decrypted/`.
- Their resource manifest is dated `2026-09-25`. It lists 115 other files.
  All 115 original plaintext SHA-256 values and container lengths match it.
  The manifest's `sha256` is a hash of plaintext JSON; its `size` describes the
  encrypted base64 file. Hashing ciphertext would give a misleading mismatch.

Resource container: `base64(nonce[12] || tag[16] || ciphertext)`, AES-GCM, with
the embedded UTF-8 key used by the framework. No additional authenticated data
was needed for these assets. `extract_resources.py` reproduces extraction with
the `cryptography` Python package. This resource encryption is distinct from
the car's diagnostic transport.

## How a light action reaches the car

```mermaid
flowchart LR
  A[UI action / flash pack] --> B[Command and parameter mapping]
  B --> C[ECU job template / UDS engine]
  C --> D[Diagnostic transport]
  D --> E[ENET / Wi-Fi / Bluetooth OBD adapter]
  E --> F[Vehicle gateway]
  F --> G[FEM / REM lighting module]
```

1. Packs such as `flash.bimmerlight` describe named actions as ordered
   `sequence` and `disable` steps. They contain symbolic commands and parameters.
2. The detected ECU's mapping turns a command such as `INDICATOR_FRONT_LEFT`
   into `STEUERN_LEUCHTENAUSGANG_DIGITAL` and channel/state arguments.
3. Its `.uds.bimmerlight` bundle provides the destination, job bytes, function
   argument schemas, and enums. The internal `CONTRACT.md` describes the compact
   engine and its rules. For these FEM commands, the job is `2F4501030000`;
   the two trailing placeholders become the channel and on/off bytes.
4. The service represents the request internally with an EDIABAS-style frame,
   then the selected transport converts it for the adapter.
5. The local OBD connection carries the diagnostic request through the vehicle
   gateway to the selected ECU. This is diagnostic output control rather than
   a captured periodic CAN broadcast.

There are backend/CDN clients and manifest updates in the app. All data needed
to construct the two selected payloads is already bundled. Static analysis
does not establish whether the original app gates its UI on account status.
The proposed independent local client does not need the original app UI.

## Connections

### ENET / HSFZ: proposed first implementation

The framework has `DetectVehicleService`, `HSFZNetworkService`, and
`NetworkServiceBase`. It contains the broadcast address `169.254.255.255`,
UDP port `6811`, and vehicle diagnostic TCP port `6801`.

HSFZ diagnostic messages have this layout:

```text
4-byte big-endian length | 00 01 | tester | destination | UDS payload
length = 2 + payload length
```

The application's HSFZ conversion explicitly maps internal source `F1` to
network tester `F4`. The internal format byte and additive checksum are not
part of this HSFZ message. For left indicator ON:

```text
UDS:       2F 45 01 03 0D 01
Internal:  86 40 F1 2F 45 01 03 0D 01 3D
ENET TCP:  00 00 00 08 00 01 F4 40 2F 45 01 03 0D 01
```

The HSFZ framing and conventional ports are independently corroborated by
[Scapy's BMW HSFZ implementation](https://github.com/secdev/scapy/blob/master/scapy/contrib/automotive/bmw/hsfz.py).
[EdiabasLib's configuration documentation](https://github.com/uholeschak/ediabaslib/blob/master/docs/EdiabasLib.config_file.md)
also specifies the default HSFZ tester address `0xF4`.

### Other implemented paths

- `ThorNetworkService` handles internal diagnostic frames with an additive
  byte checksum, echo filtering, partial-frame buffering, and response-pending
  handling. Its framing must not be confused with HSFZ framing.
- Bluetooth classes exist for UniCarScan, OBDLink, KONNWEI, Veepeak, Vgate,
  vLinker, and BimmerCommander. There are adapter configuration and ISO-TP base
  classes rather than one universally interchangeable Bluetooth connection.
- Adapter setup includes strings such as `ATSPB`, `ATCAF0`, `ATSH6F1`, and
  `ATFCSH6F1`. Exact initialization, BLE characteristic IDs, addressing and
  flow control need recovery for whichever adapter is selected.
- `OBDLinkEAService` uses Apple's ExternalAccessory path; the app declares
  accessory protocol `com.obdlink`. There is also `VlinkerNetworkService`.

Supporting all adapters would expand the first proof of concept considerably.
A direct ENET cable on this Windows computer is the proposed starting point;
the user's available hardware may justify a different choice.

## F32 evidence and two commands

The vehicle catalog contains 82 F32/F32 LCI type-code entries. The ECU index
identifies the following module families:

| Module | Diagnostic destination | Identity index | App mapping group |
| --- | --- | --- | --- |
| FEM_20 | `0x40` | `0F16B0` | CAS |
| REM_20 | `0x72` | `0F16C0` | FRM |

The ECU index labels these families `BAUREIHE=F20`. That is not a direct
F32-to-module installation table. F32 use of the recovered FEM/REM commands is
a candidate to confirm with the car's diagnostic identity. The model catalog
alone does not prove which hardware or software is fitted to a particular car.

For `FEM_20`, the recovered mappings and schema give:

| Action | Channel | ON payload | OFF payload |
| --- | --- | --- | --- |
| Front left indicator | `0x0D` / `FRA_V_L` | `2F 45 01 03 0D 01` | `2F 45 01 03 0D 00` |
| Front right indicator | `0x0E` / `FRA_V_R` | `2F 45 01 03 0E 01` | `2F 45 01 03 0E 00` |

Byte meanings: `2F` = IO control, `4501` = light-output identifier,
`03` = short-term adjustment, followed by the channel and requested state.
These are output requests; a single ON request should not be assumed to create
the normal timed turn-signal flashing behavior. The app's flash action contains
explicit ON and OFF steps.

Supporting session/cleanup payloads from the same data:

| Purpose | Payload |
| --- | --- |
| Read module identity | `22 F1 50` |
| Read VIN from FEM | `22 F1 90` |
| Enter extended session | `10 03` |
| Return light control to ECU | `2F 45 01 00 FE` |
| Restore default session | `10 01` |

Turning a light off and returning its control to the ECU are distinct operations.
The release payload above is taken from the app's `RETURN_CONTROL` mapping,
including its `FE` argument; its acceptance must still be tested on the car.

The original front-indicator flash actions also enter the KOMBI diagnostic
session and run `KOMBI_ON`, then use `KOMBI_OFF` during disable. For `KOMB01`,
these are raw routine payloads `31 01 F0 12 01 FC 21` and
`31 01 F0 12 01 FC 00`. The mapping describes them as cluster feedback.
Whether that extra routine is necessary for the two FEM output commands is
unverified. The candidate minimal sequence deliberately exposes this as an
open question; it does not claim complete parity with the full app action.

## Proposed implementation and validation

1. **Connection and identity.** Implement one adapter path. Discover or enter
   the gateway IP, connect, read `22 F1 50` at `0x40`, and verify FEM_20's
   identity index. Read vehicle identity/type information to confirm F32;
   do not treat a generic BMW VIN prefix as F32 identification.
2. **One output at a time.** Enter `10 03`, require its positive response,
   send one selected indicator ON request, then OFF after a short bounded
   interval. Record timestamped transmit/receive bytes. Start testing parked.
3. **Cleanup.** Attempt return-control and default-session restoration after
   completion, cancellation, or errors while the connection remains usable.
   Report cleanup failures. A lost connection means delivery cannot be promised.
4. **Second output.** Repeat for the other front indicator. Capture ECU identity,
   firmware/variant information, positive/negative responses and visible behavior.
5. **Only then build the UI.** Two controls, connection/identity status, and Stop.
   Existing profiles can later support other lights and shows.

The transport must handle fragmented/coalesced TCP frames, distinguish gateway
ACKs from ECU-positive responses, check response source and echoed identifier,
handle negative responses and `7F <service> 78` response pending, and bound all
waits. A `2F` request normally expects a `6F` response; a gateway ACK alone does
not prove the output changed. Avoid automatically retrying an actuation after
an ambiguous timeout.

Keepalive deserves a live check: the bundle supplies `DIAGNOSE_AUFRECHT=3E FF`,
whereas many UDS implementations use `3E 80`. Do not substitute one for the
other or assume either suppression behavior without verifying this module.
The first bounded pulse can be tested without designing a long-running show.

The car's model year, fitted lighting, and exact adapter are the remaining
inputs for the implementation choice. The proof of concept should stop on an
unexpected ECU identity or unsupported response, rather than try other variants.

## Reproducibility and evidence

- `decrypted/FEM_20.json`: selected commands at lines 138 and 149; extended
  session at line 662; return-control at line 704.
- `decrypted/FEM_20.uds.json`: address at line 3 and job template at line 139.
- `decrypted/ecu_modules.json`: FEM_20 at line 1804; REM_20 at line 2819.
- `f32_profile.json`: narrow command/schema evidence, all F32 type entries,
  and hashes of the analyzed application and diagnostic framework binaries.
- `inspect_macho.py`: dependency-free export trie, function-start and string
  reference extraction. Its string-reference scan is a locator, not a complete
  ARM64 decompiler or full control-flow reconstruction.
- `EdiabasKit.exports.txt`: `decryptDownloadedEncryptedData` at virtual address
  `0x779A8`; `HSFZNetworkService.prepareSendData` at `0x3CC70`.
- HSFZ helper `0x3D398`: source byte loaded at `0x3D4B4`, compared with `F1`
  at `0x3D4B8`, `F4` loaded at `0x3D4BC`, selected at `0x3D4C0`, stored into
  network byte 6 at `0x3D4C4`; destination stored at `0x3D4D4`.
- Detection code materializes port 6811 at `0x39DA0` and port 6801 at `0x3AECC`.
- Original `Frameworks/EdiabasKit.framework/CONTRACT.md`: engine/template,
  session and transport contract. Its historical validation counts are the
  document author's claims, not tests performed during this analysis.

Seven verification tests passed, covering both executable encryption flags,
all 115 manifest asset hashes/lengths and decoded content, the four selected
on/off vectors, exact internal and ENET packet bytes, cleanup, and unsupported
command rejection. Extraction authenticated all 116 resource files, including
the manifest. Tests requiring resource authentication use `cryptography`:

```powershell
python analysis/inspect_macho.py
python analysis/extract_resources.py
python analysis/verify_findings.py
```

Extraction and authentication were executed using an already installed local
`cryptography` package; no new dependencies were downloaded. The offline
packet generator uses only Python's standard library.
