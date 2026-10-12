# Command and diagnostic pipeline — BimmerLight 3.8 iOS

This is offline, static analysis of the supplied artifact. Nothing here records app execution, adapter traffic, or a vehicle response. REA's native provider was unavailable on this Windows x64 host analyzing an ARM64 target, and artifact inspection was rejected by client policy; focused Mach-O metadata, resources, ARM64 words, and a deliberately partial decoder were used instead. Unknown instruction classes remain raw words.

## Source identity and anchors

- Binary: `Payload/BimmerLight.app/Frameworks/EdiabasKit.framework/EdiabasKit`, SHA-256 `a16095fb744d0a93a557c1c2dbdc2f794fdda6a39e91a3e7e5fe6c2ecaf96362`.
- Shipped document: same framework's `CONTRACT.md`, SHA-256 `de30e71dd3f3204c8deb6a23e0e5783a1bc38a2d246a0c168389268a09145213`.
- Resource examples: local decoded JSON in `analysis/decrypted/`; extraction and carrier identities belong to the companion resource/catalog analysis.
- Code addresses below are unslid Mach-O VAs in EdiabasKit, not live process addresses. `EdiabasKit.exports.txt`, `EdiabasKit.references.txt`, `protocol-instructions.txt`, and `protocol_static.py` retain reproducible local evidence.

## Architecture

The supported reconstruction is:

`ActionPack.actions → Action.sequence / Action.disable → ActionStep → Mapping(sgbd, group, command, function, args) → ExecuteLightServiceImpl / ExecuteLightQueue → EdiabasServiceImpl.executeJob(sgbdName, jobName, args) → UdsEngine payload or service intercept → DiagnosticTransport.communicationService → selected Bluetooth/network adapter`.

These are distinct representations. An action is timed choreography. A command is a logical name such as `COMMUNICATION_OFF`. A mapping chooses a module family (`sgbd`), an executable job/function name, and argument strings. The engine builds diagnostic bytes for that module family. The adapter then turns the service's logical frame into the appropriate transport packet. A mapping's group is a logical selector, not proof of a CAN identifier.

Exported model accessors corroborate the fields: Action `sequence`, `disable`, `repeatCount` metadata at `0x10b40c–0x10b414`; ActionStep `command`, `group`, `params`, `delayMs`, `mapping` at `0x10b8a8–0x10b8b8`; Mapping `sgbd`, `group`, `command`, `function`, `args` at `0x10d0b8–0x10d0cc`. Execution API anchors are `ExecuteLightServiceImpl.enqueue` `0xb91e8`, queue enqueue `0xb60ec`, and `EdiabasServiceImpl.executeJob` dispatch thunk `0xd113c`.

The service implementation at `0xcbbd0` calls `0xe4088`, a preference getter for `ek.useUdsEngine`; it returns true when no preference object exists (`0xe41cc`). It then tries `UdsEngine.actuationPayload` (`0xe3518`, debug name reference at `0xe3700`), and branches to `sendEngineActuation` (`0xce970`) when a payload was built (`0xcc254–0xcc2a4`). Otherwise it checks service-intercept names, then branches to `sendEngineRead` (`0xcc718`, branch `0xcc4c8`). This is a recovered static path; preference state and any runtime selection are unknown.

An engine service allowlist is retained in static data `0x149aa0`: `10 11 14 20 28 2E 2F 30 31 3E`. The actuation path tests the first payload byte against it (`0xe37cc–0xe381c`); the read-payload path rejects bytes in that set (`0xe3b94–0xe3bc8`). DS2 (`D0…`) has additional job classification. This supports separating reads from actuation by generated service bytes, rather than assuming a function name or resource suffix alone describes the operation.

`DiagnosticTransport.shared` and `communicationService` are public exports (`0xc9500`, `0xc95b0`). `setInterface` (`0xc9644`) resolves a service from interface-keyed registrations and writes the selected service into the shared transport. The sending routines retrieve this abstraction and call its `sendRequest` protocol witness; the protocol export is `0x109460` and requirement metadata is `0x11b1d0`. Framework composition-root exports expose HSFZ, THOR, vLinker, OBDLink, UniCarScan, and other adapter services. See `connection-inventory.md` for exact supported interfaces and endpoints.

## Exact service intercepts

| Mapping/function | Recovered payload behavior | Static source |
|---|---|---|
| `COMMUNICATION_CONTROL` | `28 <arg0> <arg1>`; absent/unparseable args individually default to `03`. Only the first two args are consumed. | Handler `0xcd030`; parser calls `0xcd39c`, `0xcd3f0`; optional tests/defaults `0xcd3dc–0xcd404`; byte stores `0xcd43c–0xcd448` |
| `IO_RETURN_CONTROL` | Starts with fixed byte `2F`, appends successfully parsed argument bytes. Empty parsed argument list produces `ERROR_ARGUMENT`. Invalid individual arguments are skipped in the inspected loop. | Handler `0xcd7e4`; parse/filter loop `0xcdb4c–0xcdbec`; fixed array `0x149ad8 = 2F`; append `0xcdc28`; empty case `0xcdd00` |
| `RAW_UDS` | Parses each argument as a byte; requires nonempty output and parsed-byte count equal to original arg count, then sends those bytes unchanged as payload. The count equality means an invalid argument causes rejection of the entire raw payload. | Handler `0xce054`; parse loop `0xce3c8–0xce468`; nonempty/count tests `0xce470–0xce484`; unparseable-payload log `0xce590`; error result path following it |

These intercepts are explicit dispatch branches: `COMMUNICATION_CONTROL` `0xcc2e8–0xcc368`; `IO_RETURN_CONTROL` `0xcc370–0xcc3f0`; `RAW_UDS` is constructed as an inline Swift short string at `0xcc3f4–0xcc404`, branch to raw handler `0xcc478`.

Concrete bundled mappings remove any ambiguity about the bytes for these examples:

- `FEM_20.json`: `COMMUNICATION_ON → COMMUNICATION_CONTROL ["00","03"] → 28 00 03`; `COMMUNICATION_OFF → ["02","01"] → 28 02 01`. The same entries appear in the inspected BDC_G05, FRM3, FLE_L, FRM_70, and LCM mappings. These examples do **not** set the `0x80` bit in the control subfunction.
- `FEM_20.json`: `RETURN_CONTROL → IO_RETURN_CONTROL ["45","01","00","FE"] → 2F 45 01 00 FE`. The `00` is the return-control parameter. `RETURN_CONTROL` is an app command name; `IO_RETURN_CONTROL` is the service intercept. Do not generalize this DID or trailing byte to every lighting ECU.
- `KOMB_SP21.json:26`: `KOMBI_ON → RAW_UDS ["31","01","A1","05","43"] → 31 01 A1 05 43`; the off entry at line 40 ends with `00`. This is a concrete raw routine-control payload, with wrapping handled by the service.
- `FLE_L.json` separately exposes the twelve combinations `CC_00_01` through `CC_03_03`, all implemented by the same intercept. Their actual support by a particular ECU is unknown.

The shared byte parser is `0xd137c`, returning an optional byte with failure carried in bit 8; callers test that bit. Its inspected code includes radix-16 parsing (`0xd1a00`). General parser behavior for every accepted spelling was not fully decompiled. The examples above use unambiguous byte strings, corroborated by descriptions and their call sites.

## Engine and module resources

The packaged `CONTRACT.md` describes declarative request construction from `jobs`, `fns`, `enums`, optional `lights` maps, and a fixed rulebook. It explicitly says `.prg` is not interpreted by this engine. The binary's `UdsBundleStore` (`0xe2884`, source path reference `0xe2ba0`) and `UdsEngine` (`0xe3518`, source path `0xe36f4`) corroborate the implementation's presence. The companion catalog analysis shows decrypted `.uds` content with those keys.

The documented resolution order is lights/fixed frames, direct jobs, ARG dispatch, direct functions, and session helpers. Direct service heads include `22 + id`, `2E + id`, `2F + id + 03`, `31 01 + id`; arguments are encoded using widths/enums. Light maps OR channel/state bits into templates. A byte-exact example documented for FEM_20 is `_STEUERN_LEUCHTENAUSGANG_DIGITAL ["0x01","1"] → 2F 45 01 03 01 01`. These assembly details are **document-supported** here; the partial decoder did not independently establish every branch's implementation or all acceptance claims in that document.

## Sessions and keepalive

The implementation explicitly recognizes `DIAGNOSE_MODE`, `DIAGNOSE_AUFRECHT`, and `DIAGNOSE_ENDE` in its request builder (`0xe6c1c`). `DIAGNOSE_MODE` writes `10 <session>` (`0xe6e90–0xe6e98`), defaulting to extended session `03` (`0xe6e60`) when the supplied session cannot be resolved. Bundled modern mappings use `ECUEXTDIAG` for mode on and `DEFAULT` for mode off.

Do **not** describe `DIAGNOSE_AUFRECHT` as universally `3E FF`. The builder checks module fixed/job data first (`0xe6d60–0xe6ffc`), then selects fallback bytes using a protocol classifier (`0xe4738`):

| Family | Keepalive fallback | End-session fallback | Static constant data |
|---|---|---|---|
| UDS | `3E 00` | `10 01` | `0x1499e0`, `0x149a70` |
| KWP (identified via IDENT starting `1A`) | `3E 01` | `20` | `0x1499b0`, `0x149a40` |
| DS2 (light template starts `D0`) | `D0 04 9E` | `D0 04 9F` | `0x149980`, `0x149a10` |

The selection is visible at `0xe701c–0xe7058` and `0xe7178–0xe71b4`. Actual resources override these fallbacks: `FEM_20.uds.json` supplies `DIAGNOSE_AUFRECHT: "3eff"`; `CAS.uds.json`/`FRM_70.uds.json` supply `"3e01"`; `LCM.uds.json` supplies a fixed end frame `D0 04 9F`. Thus the shipped documentation's broad `3E FF` statement describes some resources, not the full implementation.

A keepalive operation's existence is established. This pass did not establish a universal periodic tester-present timer, frequency, or whether it runs throughout every action. Queue/session-rate-limit state and logging exist (`kDiagnoseLimit`, timestamps, skipped recent `DIAGNOSE_MODE_ON`), but runtime cadence remains unknown.

## Logical framing versus adapter packets

Service routines wrap payloads as `[0x80 | payload.count, ecuAddress, 0xF1] + payload`. Direct instruction evidence includes actuation `0xced90–0xcedc8`, raw `0xce4b4–0xce4e0`, read `0xccd3c–0xccd6c`, and communication `0xcd464–0xcd484`. ECU addresses are looked up for the module (`0xcb068` called from the handlers); they are not inferred by interpreting an SGBD name as a CAN arbitration ID.

This logical frame is **not necessarily the wire packet**. Root transport analysis found HSFZ/ENET building a separate packet at `0x3d398`: for payload length N, it allocates N+8, stores big-endian N+2 in the first four bytes, type `00 01`, source (logical F1 translated to F4), destination, then N payload bytes. Exact instruction anchors are in `transport-instructions.txt`. THOR's path includes checksum preparation (`0x40eec`) and `%02X` logging; the formatter returns the preserved byte buffer, so the log does not establish an ASCII wire format.

`CONTRACT.md` specifies an arithmetic byte-sum checksum (not XOR) for THOR's logical frame and gives an example. Receive-side code references `THOR: checksum mismatch, returning error` at `0x4070c` and `NRC 0x78 (responsePending), waiting for final response` in `ThorNetworkService.processReceivedData`. Adapter-specific framing/checksums should be kept separate from UDS service semantics.

## Reads, responses, and failures

The document's §6 claim that reads still go through a VM is stale relative to the inspected binary path. `sendEngineRead` at `0xcc738` calls the engine read-payload builder `0xe3acc` (`0xcc77c`), wraps and sends (`0xcccf0`), and its response continuation calls the engine decoder `0xe3c0c` (`0xcce84`). If no request exists, it produces `ERROR_JOB_NOT_FOUND` (`0xcc9bc`); no address or selected communication service yields `ERROR_COMMUNICATION`; no response produces `ERROR_ECU_NO_RESPONSE` (`0xccea0–0xcceb4`). A decode fallback wraps response data when the engine decoder returns nil (`0xccec0` onward). This establishes a static read route, not actual execution or comprehensive removal of all legacy code.

Diagnostic results use the public `[String:[ResultData]]` API. `0xd1250` constructs a `JOB_STATUS` result from a status string. Transport-thrown errors propagate through asynchronous continuations. `lastNegativeResponse` is part of both service and Bluetooth API metadata; queue behavior includes rejected-mapping suppression, KOMBI retry/muting state, cancellation, restore-disable after natural finish, and resetting session timestamps when the queue empties. These are corroborated by symbols and referenced messages around `0xb7a2c`, `0xbbc6c`, and `0xb7314`; exact thresholds and ECU-specific NRC policy were not fully recovered in this pass.

## Resource update servers are separate from vehicle transport

Defaults `https://api.bimmerlight.com/` and `https://cdn.bimmerlight.com/` are referenced at `0x14520` and `0x14618`; `manifest.bimmerlight` at `0x14894`. The decoded manifest declares `cdn_base`, versioned information/mapping/pack paths, counts, sizes, and SHA-256 values. `CheckForUpdatesImpl` uses HTTP fetch/download/decode paths with dedicated messages (`0xe9bd0`, `0xe9dc8`, `0xeae60`, `0xeb258`, `0xeb40c`).

This is configuration/data distribution, distinct from `DiagnosticTransport` and adapter services. Static presence of those HTTPS hosts does not imply that a light command is sent to a cloud ECU-control API. No live request was made to those hosts, and server freshness/contents were not tested.

## Remaining limits

The pipeline is reconstructed from matching static resources, metadata, references, and selected byte-building instructions. Full Swift decompilation, app-screen-to-enqueue references, every parameter-substitution branch, complete async error/NRC policy, all packet protocols, actual connected ECU selection, timing, and successful physical effects remain unobserved. Developer statements in `CONTRACT.md` about ground-truth parity and previous live-car tests are claims in the shipped document, not tests performed during this investigation.

## Focused port appendix

A targeted immediate/field/call-site pass ties several numeric constants to network configuration; these are not inferred from external BMW documentation:

- HSFZ detection constructor `0x39cc4` builds packed `0x1A911A9B` at `0x39da0–0x39da8`, storing it at object offset `0x20`. The Swift field descriptor at `0x120c3c` orders `socketFD`, `broadcastAddresses`, `sendPort`, `vehiclePort`, `broadcastData`, and other detection state, consistent with 16-bit send port **6811** at `+0x20` and vehicle port **6801** at `+0x22`. Discovery has stronger direct evidence: `sendBroadcastMessage()` `0x3b844` calls `inet_addr`, constructs sockaddr bytes `10 02 1A 9B` (`0x3b8f8–0x3b900`), and passes its address to helper `0x3be68`. Thus the IPv4 discovery destination port 6811 is established. The vehicle-connection continuation captures 6801 at `0x3aecc–0x3aed0`; the complete connection closure was not traced in this bounded pass.
- THOR default constructor `0x3f178` writes **23** to its dynamic `directPort` field (`0x3f21c–0x3f220`). Field descriptor `0x120cec` lists `ipAddress`, `directPort`, `rxBuffer`. Its detect continuation loads the configured IP, places 23 in argument `x2` (`0x3f434`), and calls `0x4a974`, whose referenced debug name is `connectTo(ip:port:)` (`0x4addc`). This directly ties THOR's default 23 to the connection port.
- vLinker's connection continuation passes **35000** to helper `0x105d38` at `0x42cf8–0x42cfc`; `connectTo(ip:port:)` passes its incoming port to that same helper at `0x4aabc–0x4aac0`. A connection-success message references `192.168.0.10` and appends 35000 at `0x433f0–0x43418`. Together these are strong static evidence for the vLinker port rather than an unrelated numeric constant.

Exact TCP/UDP typing of the THOR/vLinker high-level connections was not independently resolved in this pass; preserve that distinction from the recovered numeric ports. No socket was opened and no endpoint was contacted. Selected words are retained in `protocol-ports-instructions.txt`.
