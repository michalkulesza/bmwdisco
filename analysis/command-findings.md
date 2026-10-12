# BimmerLight 3.8: command resources and their meaning

Scope: offline static inspection of the supplied extracted iOS app. No vehicle, adapter, socket, Bluetooth, or CDN interaction was performed. Paths below are workspace relative and line numbers refer to the existing formatted JSON artifacts. This is a description of recovered resources, not a verified vehicle command implementation.

## Evidence and integrity

- Independently re-decrypted all **116** original `Frameworks/EdiabasKit.framework/*.bimmerlight` files using AES-GCM and authenticated each tag. Each parsed plaintext is equal to its existing `analysis/decrypted/*.json` counterpart. Every encrypted resource also matches both SHA-1 and SHA-256 recorded in the framework's `_CodeSignature/CodeResources`. Detailed digests/results are retained in `analysis/command-catalog.json` under `verification`. This verifies local resource consistency, not an Apple trust chain or publisher identity.
- `Frameworks/EdiabasKit.framework/CONTRACT.md` is present in the framework code-resource list at line 43; its recorded SHA-1 and SHA-256 also match. It is therefore a resource of the supplied package, rather than an assumed analyst note. It documents the compact JSON engine, request assembly and transport. Its claims of historical real-car tests and byte parity are **documentation claims**, not tests reproduced during this investigation. Some documentation counts and implementation status descriptions are stale/inconsistent with this bundle.
- Counts from parsed resources: **51 mapping files**, **1,554 mapping rows**, **256 distinct command strings including an empty string**, **52 UDS bundles**, **3,241 raw job templates**, **5,089 function definitions**, **9 packs with 285 actions**. Distinct strings are not the count of safe/user-visible/working features. The package includes placeholders, duplicates across ECUs, numeric LED groups, and diagnostic commands.
- Reproducer: `analysis/build_command_catalog.py`. It only reads local originals, authenticates and compares them, and writes catalogs. It requires `cryptography`; this run imported the already cached cryptography and cffi wheels without installing anything.

## The command pipeline

Observed resources define three layers:

1. **Pack/action:** A user-facing title and a `sequence` of symbolic commands, plus a separate `disable` sequence. Each step specifies target logical groups and may provide parameter strings. Example: `analysis/decrypted/flash.json:65` starts the Position Left action; it enters diagnostic mode for applicable groups, provides an on and off parameter set, and later has cleanup. `analysis/decrypted/headlight_show.json:65` defines Runway Sweep across left/right headlight modules.
2. **Mapping:** A row containing `sgbd`, `group`, `description`, `command`, `function`, and `args`. For instance `analysis/decrypted/FEM_20.json:6` maps `LOW_BEAM_LEFT` to `STEUERN_LEUCHTENAUSGANG_DIGITAL` with channel `0x01` and `{param_aktion}`. The same symbolic command has a different function/channel on other ECU variants.
3. **ECU bundle:** `<sgbd>.uds.json` supplies its destination `addr`, ready-made `jobs`, function schemas `fns`, enum tables, and sometimes light templates/channel bit masks. These are ECU payload definitions; they are not IP addresses, TCP ports, CAN identifiers or complete adapter packets.

Inference: the app matches detected ECU identities to a compatible mapping, substitutes pack parameters, assembles a diagnostic payload and passes it to the selected transport. The exact runtime filtering, fallback order, scheduling, skip-on-missing behavior and failure cleanup require code evidence beyond these JSON files. A group list in an action does not prove the app transmits to every listed group on every car.

The shipped contract describes request assembly at `CONTRACT.md:45`: special light templates/fixed frames; raw job templates; `ARG` dispatch to a named function; direct named functions; session/raw intercepts. Widths are generally 1/2/4 bytes and big-endian; enum names become numeric values. Some rules are specialized and the broad contract description is insufficient to reproduce every mapping, as documented under limitations below.

## Parameter meaning

The following values are directly observed in the packs. Each pack step supplies all or many of these, and a particular mapping consumes only the placeholders appearing in its arguments. Example complete sets: `analysis/decrypted/flash.json:90` and its subsequent Position Left steps.

| Placeholder | On values in packs | Off values in packs | Meaning supported by schemas |
|---|---:|---:|---|
| `param_aktion` | `1` | `0` | Digital output action/state, often one byte |
| `param_aktion_einaus` | `ein` | `aus` | German on/off enum for older lamp jobs |
| `param_steuern_io` | `STA` | `STA` | I/O-control operation; `STA=03` in contract |
| `param_steuern_routine` | `STR` | `STPR` | Start/stop routine; `STR=01`, `STPR=02` |
| `param_zeit` | `100` | `0` | Time field for aggregate light functions, frequently 2 bytes |
| `param_lhm_zeit` | `100` | `0` | Time field for headlight/rear channel control, frequently 1 byte |
| `param_lhm_pwm` | `100` | `0` | PWM/brightness field, frequently 1 byte |
| `param_lhm2_pwm` | `250` | `0` | LHM2 brightness register value, 1 byte |
| `param_rlm_strom_ausgang_wert` | `100` | `0` | Rear-light output-current value, 2 bytes on RLM2 |

Do not infer that all `100` values mean 100 seconds, 100 percent or 100 mA. The resource names establish roles; physical units/scaling vary. For example BDC_G05 `LEUCHTEN_FUNKTION` includes a time scale `[100,1,0]`, while FEM_20's similarly named function lacks that scale. Runtime write-side scaling semantics are not established from this resource alone. No explicit per-step sleep/delay/duration field was found in these 285 actions; show timing must be supplied by app scheduling, ECU behavior, or user-selected settings.

The contract's fixed rules at `CONTRACT.md:39` are:

| Domain | Symbol values |
|---|---|
| I/O control | `RCTECU=00`, `RTD=01`, `FCS=02`, `STA=03` |
| Routine | `STR=01`, `STPR=02`, `RRR=03` |
| Session | `DEFAULT=01`, `ECUPM=02`, `ECUEXTDIAG=03`, `ECUSSDS=04`, `ECUADS=05`, `SUPPLIER=60` |

Protocol interpretation of these symbols: return control to ECU, reset to default, freeze current state, short-term adjustment; start, stop and request routine results; default/programming/extended/manufacturer diagnostic sessions. These human-readable expansions are protocol interpretations, whereas the symbol-to-byte values are direct package observations.

## Representative exact payload derivations

These are static derivations from the mapping and bundle, using the documented assembly rules and the pack's on/off values. They are **payloads before adapter-specific framing/checksum**. No ECU acceptance or physical effect has been observed here.

| ECU / symbolic command | Payload | Meaning / source |
|---|---|---|
| FEM_20 `LOW_BEAM_LEFT`, on | `2F 45 01 03 01 01` | I/O control DID `4501`, short-term adjustment, channel `01`, action `01`. Mapping `FEM_20.json:6`; job `FEM_20.uds.json:139`; direct equivalent schema at `:222`. |
| FEM_20 same, off | `2F 45 01 03 01 00` | Same channel, action `00`. |
| FEM_20 aggregate `HIGH_BEAM`, on | `2E D5 42 00 05 00 64` | Write light-function DID `D542`, element 5, time field 100. `FEM_20.json:467`; schema `FEM_20.uds.json:4285`. Contract `:81` supplies this exact transport example. |
| BDC_G05 `LOW_BEAM_LEFT`, on | `2F E3 B5 03 01 01` | `LICHT_AUSGANG_DIGITAL_STEUERN`, DID `E3B5`, channel 1. Mapping `BDC_G05.json:6`; schema `BDC_G05.uds.json:17512`. |
| BCP_SP21 `LOW_BEAM_LEFT`, on | `2F E3 B5 03 00 01` | `ACTUATOR`, same DID but channel **0**. Mapping `BCP_SP21.json:6`; schema `BCP_SP21.uds.json:39248`. |
| FRM3 `LOW_BEAM_LEFT`, on | `2F 01 04 03 64` | Light template with AL_L index 4 and state byte `64`. Mapping `FRM3.json:50`; light table `FRM3.uds.json:3238`. |
| FRM3 same, off | `2F 01 04 03 00` | Same channel index; zero state. |
| REM_20 rear-position `REAR_LEFT`, on | `2E 45 01 14 01` | Template channel SL_L=`14`, on=`01`. `REM_20.uds.json:4193`; contract `:54`. |
| FLE_L `LED_1_LEFT`, on | `31 01 A5 43 01` | Start LED-element routine `A543`, element 1. `FLE_L.json:6`; schema `FLE_L.uds.json:178`. |
| FLM02_L `LED_1_LEFT`, on | `31 01 A5 4B 01 64 64` | Start channel routine `A54B`, channel 1, PWM 100, time 100. `FLM02_L.json:21`; schema `FLM02_L.uds.json:1257`. |
| FLM02_L same, off | `31 02 A5 4B 01 00 00` | Stop routine, channel 1, zero PWM/time as supplied by packs. |
| RLM2_1L `GROUP_1_LEFT_1_LEFT`, on | `31 01 A5 56 60 64 00 64 64` | Routine `A556`, group/channel `60`, PWM100, current-field100 (2 bytes), time100. `RLM2_1L.json:6`; schema `RLM2_1L.uds.json:685`. |
| LCM `LOW_BEAM_LEFT` | `D0 10 0C 00 00 00 00 40 00 00 00 00 00 00 00` | DS2 light template; AL_L sets byte-offset7 mask40. `LCM.json:6`; `LCM.uds.json:9`. No per-channel `{param_aktion}` exists in this mapping. |
| LCM `ALL_OFF` | `D0 10 0C 00 00 00 00 00 00 00 00 00 00 00 00` | Empty-channel light template. `LCM.json:256`. |
| KOMB_G11 `KOMBI_ON` | `31 01 F0 12 01 FC 32 21` | Cluster feedback routine, fixed arguments. `KOMB_G11.json:26`; contract `:59`. |
| KOMB_G11 `KOMBI_OFF` | `31 01 F0 12 01 FC 32 00` | Same feedback command, last byte zero. `KOMB_G11.json:39`. |
| KOMB_SP21 `KOMBI_ON` | `31 01 A1 05 43` | Raw UDS, described as cluster blinker telltale. `KOMB_SP21.json:26`. |
| KOMB_SP21 `KOMBI_OFF` | `31 01 A1 05 00` | Raw UDS. `KOMB_SP21.json:40`. |

This illustrates why a command name alone is insufficient: `LOW_BEAM_LEFT` uses different DIDs, channel numbers, service families and state encodings depending on the ECU. Likewise `LED_1_LEFT` identifies a hardware channel, not a universal anatomical light function across all headlights.

German abbreviations in common channel descriptions: `AL`/Abblendlicht = low beam; `FL`/Fernlicht = high beam; `TFL`/Tagfahrlicht = daytime light; `SL`/Standlicht = position/parking light; `BL`/Bremslicht = brake; `NSW` = front fog; `NSL` = rear fog; `RFL`/`RFS` = reverse; `FRA`/`BLK` = indicator; `KZL` = license plate light; suffixes `L/R` = left/right and `V/H` = front/rear. The mappings explicitly pair these descriptions with English command names; variant-specific meanings take precedence over the abbreviation.

## Session, communication, release and reset

The resources distinguish these operations; they are not interchangeable:

| Symbolic operation | Observed/documented payload | Interpretation and evidence |
|---|---|---|
| `DIAGNOSE_MODE_ON` on modern ECUs | `10 03` | Enter extended diagnostic session. Mappings pass `ECUEXTDIAG`, e.g. `FEM_20.json:662`; session rule `CONTRACT.md:41`. |
| `DIAGNOSE_MODE_OFF` on modern ECUs | `10 01` | Return to default diagnostic session, e.g. `FEM_20.json:672`. This is not an ECU reboot. |
| `DIAGNOSE_AUFRECHT` | Generally documented `3E FF`; older mappings can differ | Keep diagnostic activity alive. Contract `:143` describes session-layer implementation. Do not equate every legacy entry with UDS without code evidence. |
| LCM `DIAGNOSE_MODE_OFF` | `D0 04 9F` | Exact `lights.fixed.DIAGNOSE_ENDE` value in LCM bundle. |
| FRM_70 / FRM_87 `DIAGNOSE_ENDE` | `20` | Legacy fixed frame in their light maps. |
| `COMMUNICATION_ON` | `28 00 03` | CommunicationControl, enable receive/transmit, normal + network-management messages. Mapping `FEM_20.json:682`. |
| `COMMUNICATION_OFF` | `28 02 01` | Disable receive / enable transmit for normal communication. Mapping `FEM_20.json:693`. It does **not** mean disconnecting the adapter or disabling all diagnostic communication. Standard subfunction meanings are corroborated by [udsoncan's implementation](https://udsoncan.readthedocs.io/en/latest/_modules/udsoncan/services/CommunicationControl.html). |
| `CC_00_01` ... `CC_03_03` | `28 <00..03> <01..03>` | 12 explicit communication-control variants on selected headlight ECUs. Descriptions include exact bytes, e.g. FLM02_L mapping. Meaning/acceptance can differ on legacy ECUs even if a generic mapping exists. |
| FEM_20 `RETURN_CONTROL` | `2F 45 01 00 FE` | Raw I/O-return operation described as returning all light outputs to ECU. `FEM_20.json:704`. Byte `FE` is present in the resource; its ECU-specific selector semantics are not independently proven. |
| BDC_G05 / BCP_SP21 `RESET_TO_ECU` | Documented header `2F E3 B5 01` | Mapping uses `RTD` (resetToDefault), no channel/action args; `BDC_G05.json:1118`, `BCP_SP21.json:953`. Actual optional-field omission/padding must follow runtime engine. Do not rewrite this as `RCTECU=00` based on the friendly name. |
| FLE/FLM/RLM2 `STOP_ROUTINE` | Documented header `31 02 <routineID>` | Mapping uses `STPR`, no optional payload args; e.g. `FLM02_L.json:266`. Per-channel off steps may include extra zero-valued fields and differ from this global stop row. |
| UDS job `STEUERGERAETE_RESET` | Common `11 01` | A real ECU reset/reboot job present in full bundles, e.g. `FEM_20.uds.json:31`. Its presence in the job catalog does not mean normal light-show cleanup calls it. |

Pack cleanup is explicit data: `headlight_show.json:457` starts a `disable` list, which turns channels off, restores communications (`:653`), clears cluster feedback and returns sessions to default (`:688`). Some other packs have smaller cleanup lists; `flash` Position Left includes `RETURN_CONTROL` for CAS and KOMBI feedback cleanup. Static resources alone do not establish whether every exception, cancellation or disconnection actually executes the `disable` list.

## ECU destinations

These are hexadecimal diagnostic destination bytes from each bundle's `addr` field at line 3. `command-catalog.json.addresses` lists every bundle individually. The embedded SGBD spelling sometimes differs in case; catalog joins use uppercase file names.

| Address | Resource families |
|---|---|
| `10` | BCP_SP21; ZGW_01 gateway |
| `40` | FEM_20, BDC, BDC_G05, BDC_G11, CAS |
| `43` / `44` | Left / right FLE, FLE02, FLM01, FLM02/02X, FLM03, FLM2_1, LHM2 |
| `60` | KOMB01, KOMB25, KOMBSP18, KOMB_G11 instrument cluster |
| `70` | LM_60, LM_AHL, LM_AHL_2, LM_E65_2 |
| `72` | FRM3, FRM_70, FRM_87, REM_20 |
| `D0` | LCM variants, LSZ/LSZ_2, LM2_83, LME38 |
| `17` / `1A` / `1C` / `1E` | RLM and RLM2 1L / 1R / 2L / 2R |

Sharing an address reflects alternate ECU variants or logical destinations; it does not prove all variants coexist. The current package has a KOMB_SP21 mapping but **no KOMB_SP21 UDS bundle**, so its destination is not directly available from that file. Assigning `60` because the other cluster variants use it would be an inference.

`ecu_modules.json` separately maps detected `ADR_INDEX` + `SGBD_HEX` to a variant `SGBD`, group and chassis family. `CONTRACT.md:118` says modern `IDENT` uses `22 F1 50` and decodes three identification bytes into `ID_SGBD_INDEX`, which is linked to `SGBD_HEX`. Other discovery/read jobs include VIN `22 F1 90`, gateway vehicle order `22 3F 06`, fault read `19 02 0C` and fault clear `14 FF FF FF`; these exist as bundle jobs and must not be conflated with light output controls. Runtime discovery code establishes which are actually requested.

## Payload transport boundary

`CONTRACT.md:77` describes a generic EDIABAS-format envelope for the engine payload: `[0x80 | payload_length, destination, 0xF1] + payload`, followed by an additive checksum modulo 256. It gives the concrete example:

```
payload:  2E D5 42 00 05 00 64
envelope: 87 40 F1 2E D5 42 00 05 00 64 66
```

The last `66` equals the sum of preceding bytes modulo256. This package documentation describes an internal adapter-facing representation, not necessarily bytes placed unchanged on a BMW Ethernet link, BLE GATT value, Wi-Fi TCP socket or CAN bus; those are transport-specific code paths. The contract says DS2 payloads retain their own full `D0 ...` frame before generic wrapping. Root transport analysis should corroborate/check this documentation against each code path.

## Material limitations and discrepancies

1. **LHM2 field updates are specialized.** `LHM2_L.json:6` uses `STEUERN ['ARG','_LEUCHTEN_AUSSENLICHT_KANAELE','KANAL1_HELLIGKEIT','{param_lhm2_pwm}']`. The target function has DID `6060`, seven brightness fields and seven current fields (`LHM2_L.uds.json:158`). The named field is not an IO-control parameter or a positional integer. Whether the engine preserves previous channel values, initializes a register or reads before writes is not inferable from the generic contract recipe. A guessed `2E 60 60 FA` would omit 13 fields.
2. **Older RLM metadata differs from its dispatcher label.** `RLM_1L` mapping names `STEUERN_ROUTINE`, but its `RLM_KANAL` schema (`RLM_1L.uds.json:631`) has service `2E`, DID `D6DA`, and argument order channel/time/PWM. Mapping argument order is channel/PWM/time. On/off packs use equal time/PWM values (100/100 and 0/0), masking that mismatch. Code is needed to establish actual dispatch and whether the generic routine label overrides schema service.
3. **Generic job and special handling overlap.** `DIAGNOSE_MODE` can have a raw job base `1001`, yet the pack needs `ECUEXTDIAG` resolved to `1003`. The contract itself defines a session special case. Likewise dispatch functions such as STEUERN_IO have generic one-byte job bases but require named function resolution. A naive jobs-first implementation would produce incorrect payloads.
4. **Legacy communication-control support is not established by listing.** Some DS2 mappings contain generic `COMMUNICATION_ON/OFF` names. That is resource evidence only; whether a legacy module accepts UDS service28 is unproven.
5. **DS2 channel requests lack a parameterized off state.** LCM's LOW_BEAM_LEFT mapping contains only AL_L, whereas pack sequences supply on/off params globally. A stateless expansion would return the same mask both times. DS2 `ALL_OFF` and session-end frames exist; runtime/state handling is required to explain how generalized actions turn an individual DS2 lamp off.
6. **Historical parity numbers are not current completeness proof.** Contract mentions 1,564 shipped commands /1,543 covered; the present package contains1,554 mapping rows. Its read-routing paragraph says reads remain VM-routed, while references to a removed/drop-EDIABAS architecture appear elsewhere. Neither branch status nor acceptance coverage should be asserted without native-code corroboration.
7. **Templates expose more than light features.** Full job catalogs include coding/data writing, key-related functions, diagnostic resets and fault operations. Their existence does not establish UI reachability or use by the app's normal actions.

## Artifacts

- `command-catalog.json`: all mappings with source lines, relevant job/function/light definitions, destination addresses, parameters, pack summary and original-resource authentication/hash results. Route labels are analysis classifications, not a guaranteed runtime order.
- `command-catalog.csv`: compact exact mapping table, one row per resource mapping.
- `job-catalog.csv`: all3,241 ECU job names and their original raw hexadecimal templates, one row per ECU/job.
- `build_command_catalog.py`: offline catalog/integrity reproducer.

Questions answered by this scope: what symbolic commands and ECU mappings are bundled; what numeric byte templates and parameter schemas exist; representative payload derivations; where reset/release/session/communication operations differ; and which data points remain insufficient for exact runtime reproduction. Timing, live compatibility, response handling, transport selection and guarantees of cleanup remain dependent on code/runtime evidence.
