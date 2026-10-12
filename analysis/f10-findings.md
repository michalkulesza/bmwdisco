# BimmerLight F10/F11 lighting: findings (static analysis only, no traffic observed)

Paths relative to /Users/michalkulesza/Projects/carrot/apps/bmwdisco/analysis (decrypted/ = analysis/decrypted).
CONTRACT = com.bimmerlight.prod-3.8-eeveedecrypter/Payload/BimmerLight.app/Frameworks/EdiabasKit.framework/CONTRACT.md

## 1. Which SGBD/ECU
- Best candidate: **FRM3** (SGBD `FRM3`, group `G_FRM`), UDS, address **0x72**. Only evidence tying a chassis family to it:
  `decrypted/ecu_modules.json:2810-2814` = {ADR_INDEX 72, SGBD_HEX 0F10D0, SGBD FRM3, GRUPPE G_FRM, BAUREIHE **F01**}.
  There is no F10/F11 row for any FRM/REM/lighting ECU (all F10 rows: SME_10, GHAS10, DSC, EPS_10, NBT, PDC_F10, ... none lighting).
  F01 (7 Series) is the only FRM3 chassis row; F10/F11 share the platform and F12/F13 comments appear in FRM3 mapping
  ("2. Blinker F12/13", "Abbiegelicht LED F12/13", FRM3.json), so F10/F11 -> FRM3 is an inference, not an explicit table entry.
- There is NO static chassis->SGBD table. `chassis_info.json` (5894 rows: name, chassis code e.g. 5A79, region, engine, body, `series` like "5' F10", "5' F10 LCI", "5' F11", "5' F11 LCI", "5' F07 GT", "7' F01/F02") is only a vehicle catalog.
  The app discovers ECUs at runtime: IDENT `22 F1 50` -> 3 bytes after `62 F1 50` = ID_SGBD_INDEX -> "0"+hex = SGBD_HEX -> lookup (ADR_INDEX, SGBD_HEX) in ecu_modules.json (CONTRACT.md:116-117). Then packs address commands by *group* (`FRM`, `CAS`, ...) so whichever ECU responds in that group is used (decrypted/flash.json sequence for "Indicator Front Left": group list ['CAS','FRM','LCM','LM','LME38','LSZ']).
- Other 0x72 SGBDs and why not them:
  - FRM_70 / FRM_87: KWP2000 style (IDENT `1a80`, DIAGNOSE_MODE `1081`, tester-present `3e01`; FRM_70.uds.json jobs). E-series (app label "E-series"). Not F10.
  - REM_20 (ecu_modules BAUREIHE F20, hex 0F16C0): UDS, rear electronics module of F20/F3x, has *no* front indicators (REM_20 channels are rear/SL_L etc.). Not F10.
- Variants: pre/post LCI, F11 (Touring), F07 GT, F01/F02, F18 are not distinguished anywhere in the data. ecu_modules has F07/F18/F02 rows for other ECUs but none for FRM. Whether every F10/F11 (incl. 2010 pre-LCI and LCI) reports index 0F10D0 is NOT recoverable statically.
- Caveat: BimmerLight's hard-coded SGBD list in the binary (EdiabasKit.strings.txt:2457-2465, BimmerLight.strings.txt:14328) names FRM_70, FRM_87, REM_20 but not FRM3; FRM3 is a newer CDN resource (manifest 2026-09-25 mappings/G_FRM/FRM3.bimmerlight; listed in packs flash.json:24 etc.).

## 2. Address and identity
- Address: `decrypted/FRM3.uds.json:3` `"addr": "72"` -> 0x72 (command-findings.md ECU table lists 72 = FRM3, FRM_70, FRM_87, REM_20).
- Identity read: `FRM3.uds.json:5` `"IDENT": "22f150"` -> `22 F1 50`, same as F32.
- Expected identity bytes: SGBD_HEX 0F10D0 => response `62 F1 50 0F 10 D0` (analogue of `62 F1 50 0F 16 B0`; the F32 path is the same decode, CONTRACT.md:117, REPORT.md:135 FEM_20 0F16B0). Marked **medium confidence**: only a single row (labelled BAUREIHE F01) exists; an F10 car with a different FRM3 hardware index would report different bytes and be rejected by a strict equality check. Recommendation: on first test, log the real bytes and compare; do not hardcode blindly. Any `62 F1 50 0F 10 D0` equality check should also accept/inspect additional bytes (our current code is strict on length 6).
- VIN: FRM3 UDS read `22 F1 90` is not defined in FRM3 jobs (only IDENT, SVK_LESEN 22F101, SERIENNUMMER_LESEN 22F18C, DIAG_SESSION_LESEN 22F186); do not assume.

## 3. Request bytes (derived like the F32 ones)
Derivation rule: FRM3 uses the "lights" route (CONTRACT.md:49-54, 137, 142), not a job template like FEM_20.
- Mapping rows (decrypted/FRM3.json): INDICATOR_FRONT_LEFT -> function `STEUERN_DIGITAL_LICHT`, args [`FRA_V_L`, `{param_aktion}`] (around lines 326-337); INDICATOR_FRONT_RIGHT -> [`FRA_V_R`, ...]. Descriptions "Fahrtrichtungsanzeiger vorne links/rechts".
- Bundle (decrypted/FRM3.uds.json:3238-3240): `lights.function = STEUERN_DIGITAL_LICHT`, `template = "2F 01 00 03 00"`; `channels.FRA_V_L = [[2,"0x1c"]]` (:3411), `FRA_V_R = [[2,"0x1d"]]` (:3417); `state.on = [[4,"0x64"]]`, `state.off = []` (:3490).
- Assembly: OR channel mask into template byte 2, OR state into byte 4.

| Action | Payload |
|---|---|
| Front left ON | `2F 01 1C 03 64` |
| Front left OFF | `2F 01 1C 03 00` |
| Front right ON | `2F 01 1D 03 64` |
| Front right OFF | `2F 01 1D 03 00` |

Format: `2F` IOControl, `01 <ch>` 2-byte DID (0x011C etc.; the channel is part of the DID), `03` = shortTermAdjustment (STA), final byte = state 0x64 (100%) on / 0x00 off. This differs from FEM_20 (`2F 45 01 03 <ch> <0/1>`, one shared DID 4501, channel after controlParam, state 01).
- Worked example in the vendor's own docs: FRM3 AL_L -> `2F 01 04 03 64` (CONTRACT.md:54,137; command-findings.md:63-64), and the contract says it is a per-channel independent IOControl (not read-modify-write) and was part of ground-truth reconstruction.
- Session: mapping DIAGNOSE_MODE_ON = function DIAGNOSE_MODE [`ECUEXTDIAG`] (FRM3.json:524-526) => `10 03`; DIAGNOSE_MODE_OFF [`DEFAULT`] => `10 01` (FRM3.uds.json:25 job `1001`). Keep-alive `3E FF` (FRM3.uds.json:24 `3eff`); F32 profile does not use it but the app does; with sessions expiring (S3 ~5 s) long sequences may need it. Communication control: `28 00 03` / `28 02 01` (FRM3.json COMMUNICATION_ON/OFF rows) - not needed for single indicator.
- Return control: **FRM3.json has NO `RETURN_CONTROL` row.** Only BDC, BDC_G11 and FEM_20 have it (`2F 45 01 00 FE`, group CAS). In the app's packs the cleanup (`disable`) is `RETURN_CONTROL` for CAS only, so on FRM3 the app relies on the OFF command (`... 00`) and on returning to default session (`10 01`, FRM3.json DIAGNOSE_MODE_OFF). Candidate extra (UNVERIFIED, from UDS standard, not in app data): `2F 01 <ch> 00` (returnControlToECU, controlParam 00) per channel. Recommendation: send OFF, then `10 01`; treat `2F 01 1C 00` as optional experimental.
- Response gating: contract notes `22 30 80` as a "gate read of status" for FRM3 (CONTRACT.md:54, no further detail; not in FRM3 jobs, KWP-like 0x30 service id suspicious). Treat as unknown; not required by the derivation.
- Cluster feedback (KOMBI_ON/OFF) accompanies every pack action; F10 cluster SGBD is unknown (no KOMB row for F10 in ecu_modules). Not needed for the lamp itself (same open question as F32, REPORT.md).
- Dash: single ON produces steady lamp, not flashing; flashing is app-scheduled ON/OFF.

## 4. Transport
- Current code hardcodes 0x40: `mobile/src/protocol/hsfz.ts:34` (`destination = 0x40` default), `mobile/src/protocol/thor.ts:6` (default 0x40), reply filters `mobile/src/wire-link.ts:64` (`packet.source === 0x40 && destination === 0xf4`) and `:69` (THOR source 0x40/dest 0xf1), request() call sites `wire-link.ts:95` pass no destination. `FEM_PROFILE.destination: 0x40` in `mobile/src/protocol/fem.ts` is not wired into the link.
- Needed: make destination a parameter (0x72) in encodeHsfzDiagnostic/encodeThorDiagnostic calls and in the two reply filters (source must equal ECU address). Framing is address-agnostic: `[len32][0001][F4][dest][payload]` (analysis/f32_packets.py hsfz_frame; protocol-findings.md:73). Example: `00 00 00 07 00 01 F4 72 2F 01 1C 03 64`.
- Does the F10 ENET port accept it: an F10 has no ZGW in the app data; ENET to F10 goes via the vehicle gateway (CIC/combox side). BimmerLight uses same HSFZ detection 6811/vehicle port 6801 (protocol-findings.md:97) for all cars; our app's port/mode setting is generic. Whether F10 needs the ENET-activation/OBD-cable differences is out of scope of the static data.
- Identity check helper must change: `isFemIdentity` is strict equality to `62 F1 50 0F 16 B0` (fem.ts).

## 5. Other exterior elements on FRM3 (same template `2F 01 <idx> 03 <00|64>`)
Source: FRM3.uds.json:3238-3500 channels, FRM3.json commands. Confidence: **high** that the byte string is what BimmerLight sends (read straight from data); **medium** that the lamp responds on a given F10 (never observed; vendor contract mentions some FRM3 outputs NRC on certain variants).
| Element | Channel | idx | ON | Notes |
|---|---|---|---|---|
| Front indicator L / R | FRA_V_L / FRA_V_R | 1C / 1D | 2F 01 1C 03 64 / 2F 01 1D 03 64 | medium-high |
| 2nd front indicator (F12/13) | FRA_V_L_2 / _R_2 | 36 / 37 | 2F 01 36 03 64 | low for F10 |
| Rear indicator L / R | FRA_H_L / FRA_H_R | 1A / 1B | 2F 01 1A 03 64 | medium |
| Low beam L / R | AL_L / AL_R | 04 / 05 | 2F 01 04 03 64 | high (vendor example) |
| High beam L / R | FL_L / FL_R | 0B / 0C | 2F 01 0B 03 64 | medium; halogen high beam / xenon cornering |
| Bi-xenon flap | BI_XENON_L_R | 0D | 2F 01 0D 03 64 | low |
| Daytime / position L,R | TFL_L/R, POS_L/R | 13 / 14 (aliases) | 2F 01 13 03 64 | medium |
| Front fog L / R | NSW_L / NSW_R | 11 / 12 | 2F 01 11 03 64 | medium |
| Rear fog L / R | NSL_L / NSL_R | 0F / 10 | 2F 01 0F 03 64 | medium |
| Tail light inner R / outer L / outer R | SL_I_R, SL_A_L, SL_A_R | 01 / 02 / 03 | 2F 01 02 03 64 | medium; SL_I_L has an empty channel list (index 00) - suspicious, low |
| Brake L / centre / R | BL_L, BL_M, BL_R | 06 / 07 / 08 | 2F 01 06 03 64 | medium |
| Reverse L / R | RFL_L / RFL_R | 15 / 16 | 2F 01 15 03 64 | medium |
| Side marker front L / R | SML_V_L / SML_V_R | 17 / 18 | 2F 01 17 03 64 | medium |
| Licence plate | KZL | 0E | 2F 01 0E 03 64 | medium |
| Hazard LED, interior, terminal 58g, welcome (VFB 22), ambient (26/27), door warning (32) | LED_WBL 1E, IB_IL 1F, KL_58G 20, VFB 22, AMB1 26, AMB2 27, TWL 32 | | `2F 01 <idx> 03 64` | low |
- No channel entries for ABBL_L/R (cornering) and BL_L_2/R_2: mapping rows exist but channels table lacks them (CONTRACT.md:143: NRC on that ECU variant). Don't expose.
- OFF is always same payload with last byte 00.
- Also FRM3 has aggregate function `LEUCHTEN_FUNKTION` DID D542 (`2E D5 42 ...`, FRM3.uds.json fns, service 0x2E) - not in mapping rows; ignore.
- Capability listing: no runtime "which lamps exist" query was found in the data; the app lists all mapped commands per detected SGBD. Failure (NRC 0x31 requestOutOfRange) on a channel is the only discovery mechanism evidenced; our app could probe by attempting a channel and reading the NRC (risky: actually toggles lamp).

## 6. Uncertainties / differences from F32
1. F10/F11 -> FRM3 / 0F10D0 is inferred from a single F01-labelled row; confirm on car by reading `22 F1 50` and sending IDENT first. If the car returns another index, check ecu_modules.json (only 0F10D0 exists for 0x72 UDS besides REM_20 0F16C0).
2. Older F10 (2010-2012) might still use FRM_70/87 style KWP; those have different frames (`1081`, `1a80`, STEUERN_LAMPEN_DIGITAL with names AUSGANG_*) - BimmerLight maps FRM_70/87 as E-series. Not recovered for F10, so ignore unless IDENT responds with `5A 80`.
3. DID layout differs: FEM `2F 45 01 03 <ch> <st>` (state 0/1) vs FRM3 `2F 01 <ch> 03 <st>` (state 00/64, channel inside DID). Do not reuse femIndicator.
4. No return-control row for FRM3; rely on OFF + `10 01`. Per-channel `2F 01 <ch> 00` unverified.
5. Response checks: positive reply for 2F is `6F 01 <ch> 03 ...` (UDS standard: 6F + DID + param + status); check mobile uds matcher compares prefix only.
6. Ground truth for other FRM3 packets exists vendor-side (uds_groundtruth.json, 1110 commands), not available here; "confirmed on live car" in CONTRACT.md:81 refers to a FEM_20 write (`2E D5 42...` -> `87 40 F1 ... 66`), the FRM3 claim at :54/:142 is by reconstruction.
7. Address in reply filter (wire-link) must be 0x72; the THOR path uses same destination byte.
