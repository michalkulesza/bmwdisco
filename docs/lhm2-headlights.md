# LHM2 headlights and F32 indicators (research, nothing implemented)

Car: real F32, adaptive LED headlights, modules FEM_20 (0x40), LHM2_L (0x43), LHM2_R (0x44), KOMB25 (0x60), REM_20 (0x72). No FLE02.
Status: static analysis only. Everything below marked "inferred" or with a confidence level is unverified on the car.

Path shorthand: `gen/` = `src/data/generated/modules/`, `ecu/` = `data/ecu/`

## 1. What the app sends today for headlights

Target resolution: every module's `elements` becomes a target (`src/domain/registry/targets.ts:11-19`); only one substitution rule exists (`brakeAll`, `src/domain/registry/rules.ts:17-23`). The "unavailable" warning and the dead-output rule fire only when FLE02 is present (`rules.ts:26-33`, `src/simulator/dead-outputs.ts:13-27`). With LHM2 and no FLE02 nothing is hidden, so the per-side tiles are offered and sent.

LHM2 contributes no elements: `elements: {}` (`gen/LHM2_L.ts:11`), because the data has one 14-field write but each mapping row names one field (`ecu/README.md` "Known gaps", `docs/PLAN.md:86`).

| UI element                                  | Module (addr) | Payload                                         | Source                   |
| ------------------------------------------- | ------------- | ----------------------------------------------- | ------------------------ |
| lowBeamLeft                                 | FEM_20 (0x40) | on `2F 45 01 03 01 01`, off `2F 45 01 03 01 00` | `gen/FEM_20.ts:12-16`    |
| lowBeamRight                                | FEM_20        | `2F 45 01 03 02 01/00`                          | `gen/FEM_20.ts:17-21`    |
| daytimeLeft / Right                         | FEM_20        | `2F 45 01 03 03/04 01/00`                       | `gen/FEM_20.ts:22-31`    |
| positionLeft / Right                        | FEM_20        | `2F 45 01 03 09/0A 01/00`                       | `gen/FEM_20.ts:52-61`    |
| highBeamLeft / Right                        | FEM_20        | `2F 45 01 03 07/08 01/00`                       | `gen/FEM_20.ts:42-51`    |
| lowBeamAll                                  | FEM_20        | on `2E D5 42 00 03 00 64`, off `... 00 00`      | `gen/FEM_20.ts:132-136`  |
| daytimeAll                                  | FEM_20        | `2E D5 42 00 04 00 64/00`                       | `gen/FEM_20.ts:137-141`  |
| highBeamAll                                 | FEM_20        | `2E D5 42 00 05 00 64/00`                       | `gen/FEM_20.ts:142-146`  |
| positionEs (parking, aggregate)             | FEM_20        | `2E D5 42 00 02 00 64/00`                       | `gen/FEM_20.ts:127-131`  |
| corneringLeft / Right (aggregate, per side) | FEM_20        | `2E D5 42 00 09/0A 00 64/00`                    | `gen/FEM_20.ts:~165-174` |

Return control: `2F 45 01 00 FE` (`gen/FEM_20.ts:9`). The per-side form is `2F` (InputOutputControlByIdentifier, DID 0x4501, control 03 = shortTermAdjustment, output id, state); the schema is `ecu/FEM_20.uds.json:224` (`ELEMENT` enum `TAB_DEV_AUSGANG_LEUCHTEN`, `ecu/FEM_20.uds.json:7454`: AL_L=1, AL_R=2, TFL_L=3, ...). The "all" form is `2E` (WriteDataByIdentifier) on DID D542 `LEUCHTEN_FUNKTION` with a 2-byte `ELEMENT` (`TAB_LAMPEN_FUNKTION`, `ecu/FEM_20.uds.json:4287`, `:8275`) and a 2-byte `ZEIT`.

Why "both" works and left/right do nothing (conclusion, partly inferred):

- D542 is a light-function request ("low beam function on"). FEM turns it into the normal bus request that both LED headlights obey, so it is inherently both-sided; there is no left-only low-beam function in `TAB_LAMPEN_FUNKTION` (`ecu/FEM_20.uds.json:8275`). Only cornering has a left/right pair (9/10).
- `2F 45 01 03 01..0C` drives FEM's own physical output pins (AL_L, AL_R, ...). On LED headlights the lamps are fed by the LHM2 driver, not by those pins, so FEM accepts the request (positive `6F 45 01`) and nothing lights. Evidence: the in-code car test comments say "FEM/BDC per-side headlight outputs replied positively but lit nothing on LED headlights" (`rules.ts:25`, `dead-outputs.ts:12`); the rule is keyed on FLE02 only, but the user's report is the same symptom with LHM2.
- So the left element does go out and is acknowledged; the car ignores it (no output behind it). "Pair" works because it takes the bus path. Confidence: high for the symptom explanation, medium that no other FEM mechanism exists.
- Small app-side fix candidate (not applied): add `LHM2_L`/`LHM2_R` to `whenAnyPresent` in `rules.ts:28` and `dead-outputs.ts:14`, so these tiles are hidden/warned.
- A real per-side option inside FEM already in the data: `corneringLeft/Right` (`2E D5 42 00 09/0A 00 64`). On adaptive LED it should light the left/right cornering segment, not low beam. Confidence medium-low that it is visible; cheap to test.

## 2. LHM2_L/R decode

Important correction to the premise: the "channel routine" is not a routine (service 31). It is a WriteDataByIdentifier: schema `_LEUCHTEN_AUSSENLICHT_KANAELE`, service 46 (0x2E), DID 0x6060 (`ecu/LHM2_L.uds.json:46-48`; read twin `s:34` at `:158-160` with results). LHM2_R is byte-identical except `addr` (`ecu/LHM2_R.uds.json:3` = 0x44; L = 0x43 at `ecu/LHM2_L.uds.json:3`; diff of both files shows only name and addr).

Write frame, 17 bytes: `2E 60 60 <14 data bytes>`; positive response `6E 60 60`. Read: `22 60 60` -> `62 60 60 <14 bytes>`.

| Offset (after `2E 60 60`) | Field                | Size   | Meaning                                                                                                                                                                                                            |
| ------------------------- | -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0-6                       | KANAL1..7_HELLIGKEIT | 1 each | PWM / brightness of LED channel 1..7. A proposed 0xFA ON value is unverified; the ECU schema does not establish the safe operating range.                                                                          |
| 7-13                      | KANAL1..7_STROM      | 1 each | LED current of channel 1..7. Schema scale tuple `[1,10,0]` on write, `[10,1,0]` on read (`ecu/LHM2_L.uds.json` fields after the PWM fields); unit is not stated, treat as opaque raw bytes (inferred: 0.1 A-like). |

Read result names confirm the order: `STAT_LED_KANAL_1..7_PWM_WERT` then `STAT_LED_KANAL_1..7_STROM_WERT` (`ecu/LHM2_L.uds.json:158-...`).

Field-to-light mapping: not in the data. The fields are generic driver channels ("Kanal 1..7", enum `TAB_KANAELE_LHM2` with channel 8 = fan "LÃ¼fter", `ecu/LHM2_L.uds.json:1550`); no low beam / high beam / DRL / indicator naming appears anywhere in LHM2 files. Related read-only DIDs: D5DA equipment flags, one byte each for low beam, high beam, position, DRL, indicator, cornering, accent, side marker, "gezieltes Anleuchten" (`ecu/LHM2_L.uds.json:930`); D515 binning per channel; D514 operating hours per channel and fan (`ecu/LHM2_L.uds.json:646-658`); D5BF fan `2E D5 BF <LEISTUNG> <ZEIT>` (`:882-897`). D5DA says which functions exist, not which channel serves them. Compare FLE02, which has a labelled `TAB_LEUCHTMITTEL` (Low beam 1-3, High beam 1-3, DRL 1-3, Cornering 1-3, Side marker 1-3, Indicator 1, Accent 1-3; `ecu/FLE02_L.uds.json:1802`) but that is a different ECU and numbering; do not transfer it.

Other LHM2 entries (`ecu/LHM2_L.uds.json:14` jobs):

- `STEUERN_ROUTINE` base `31`; the only routine function in LHM2 is `A534 LEUCHTEN_FUNKTIONSTEST_LED_SCHEINWERFER` (`:603`), no arguments: `31 01 A5 34` may start the built-in LED headlight function test (inferred). There is no `31 02` stop for it in the mapping.
- `_STEUERN_FUSI_LED` 6068 (`:580`) and `_STEUERN_FUSI_CRC` 6067 are functional-safety test writes; do not touch.
- `STEUERN_ROE_PERSISTENT_*`, `ENERGIESPARMODE`, `STEUERN_BETRIEBSMODE`, `STEUERGERAETE_RESET` (`11 01`) exist as jobs; irrelevant and risky.
- Mapping rows: `LED_1..7_LEFT` -> `STEUERN ARG _LEUCHTEN_AUSSENLICHT_KANAELE KANALn_HELLIGKEIT {param_lhm2_pwm}` (`ecu/LHM2_L.json:5-11` onward), `DIAGNOSE_MODE_ON/OFF` -> `10 03`/`10 01` (`ecu/LHM2_L.json:97`), `COMMUNICATION_ON` `28 00 03`, `COMMUNICATION_OFF` `28 02 01` (`ecu/LHM2_L.json:127-128`), plus the twelve `CC_xx_yy` variants (`:205` etc.). There is no return-control row (no `2F`/`IO_RETURN_CONTROL`). FLE02 by contrast has `STOP_ROUTINE` (`ecu/FLE02_L.json:169`), a `31 02 A5 43 STPR` that LHM2 does not have.
- Identification: `22 F1 50` -> `0F 1B 20` = LHM2_L (listed under chassis F01, `data/ecu/README.md`); chassis label is irrelevant, the module is what is on the car.

Static ECU data does not establish how a client should populate the other 13 bytes when changing one `KANALn_HELLIGKEIT` field. Read-modify-write, zero fill, and a retained register image remain possible; this cannot be settled from the schema alone.

`28 02 01` semantics: UDS CommunicationControl, subfunction 02 = disable receive / keep transmit, communicationType 01 = normal application messages. Effect on LHM2 (inferred): it stops listening to FEM's cyclic light requests so FEM cannot overwrite the diagnostic PWM; it still transmits. `28 00 03` = enable Rx and Tx for normal and network-management messages (restores). Current app behaviour for FLE02: send `28 02 01` after `10 03` to modules serving a `headlightLeds` element, and `28 00 03` in cleanup (`src/domain/runner/plan.ts:113-123`, `runner.ts:210-213`, `cleanup.ts:92-95`).

## 3. Proposed per-side LHM2 elements

Principle: write the whole 14-byte record every time, and never invent the 7 current bytes: read them from the car first (`22 60 60`) and echo them back. Only PWM bytes are changed.

Session sequence per module (L = 0x43, R = 0x44):

1. `10 03` (extended session). `2E` on a data DID normally needs it (inferred).
2. `28 02 01` so FEM's bus requests do not fight the write (inferred, medium). Needed if the write has no visible effect or is overwritten within a few hundred ms.
3. `22 60 60` once, store `P1..P7` (current PWM, normal state) and `I1..I7`.
4. ON/OFF writes (below).
5. Release: write the stored baseline `2E 60 60 P1..P7 I1..I7` (or all PWM 0 if the lamp was off), then `28 00 03`, then `10 01`. No return-control service exists for this module; the session reset to default is the release (inferred, must be tested).

Candidate elements, channel k = 1..7. `I..` are the current bytes read back in step 3; `Z` means unknown-until-read. A zero-current variant is NOT proposed: zero current may mean "limit 0" and is unverified.

| Candidate           | ON payload (module L or R)                                          | OFF payload                                          | Confidence                                                       |
| ------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| channel k lit (k=1) | `2E 60 60 FA 00 00 00 00 00 00 I1 I2 I3 I4 I5 I6 I7`                | `2E 60 60 00 00 00 00 00 00 00 I1 I2 I3 I4 I5 I6 I7` | medium that frame is accepted; low that only this channel lights |
| k=2                 | `2E 60 60 00 FA 00 00 00 00 00 I..`                                 | all PWM `00`                                         | same                                                             |
| k=3                 | `2E 60 60 00 00 FA 00 00 00 00 I..`                                 | same                                                 | same                                                             |
| k=4                 | `2E 60 60 00 00 00 FA 00 00 00 I..`                                 | same                                                 | same                                                             |
| k=5                 | `2E 60 60 00 00 00 00 FA 00 00 I..`                                 | same                                                 | same                                                             |
| k=6                 | `2E 60 60 00 00 00 00 00 FA 00 I..`                                 | same                                                 | same                                                             |
| k=7                 | `2E 60 60 00 00 00 00 00 00 FA I..`                                 | same                                                 | same                                                             |
| "left low beam on"  | the channel (k_low) found in the read-back test, others at baseline | baseline                                             | low until mapped                                                 |

Careful: "all other PWM at 0" in the table forces other channels dark; if low beam is currently a normal-state channel, this also turns it off. For a clean "left low beam ON", the proper form is: read baseline in the "lights off" state, set the target PWM to 0xFA, leave the rest at the read-back.

Deriving the mapping (the only way to get a "left low beam" element honestly): with ignition on, park, read `22 60 60` in each normal state: lights off, low beam, + high beam, DRL only, indicator active, cornering/turn. The channels whose PWM changes are that function's channels. Do this on LHM2_L and R; the diff gives the field-to-function map without writing anything. Repeat the writes only after that.

Expected side effects:

- Writes before the mapping is known would light unknown segments, possibly a high-current group (e.g. all low-beam LEDs at 250/250). Keep the first write to a single channel with a short ON time (<1 s) while parked.
- Risk: PWM 250 on a channel whose current setpoint `I_k` is 0 may do nothing; echoing the read-back avoids that.

Elements to generate eventually (names fit the existing id scheme): `lhm2ChannelLeft1..7`, `lhm2ChannelRight1..7`, category `headlightLeds`, with `silenceCommunication` true; map them to nameable functions only after the read test.

## 4. Risks

| Risk                 | Detail                                                                                                                                                                                                                                                                                           | Mitigation                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stuck-lit LED module | A `2E` write is not an IO-control short-term adjustment; there is no `2F` return control. If the link drops after the ON write, the PWM may persist until the session times out (S3, typical 5 s with no `3E`) or the module resets (inferred; PLAN.md:97 notes expiry behaviour is unverified). | Always send OFF/baseline; keepalive `3E FF` while active (`keepalive` in `gen/LHM2_L.ts:9`); on reconnect: `10 03`, baseline write, `28 00 03`, `10 01`. If stuck: ignition cycle. |
| `28 02 01` left on   | With Rx disabled the headlight stops obeying FEM (no low beam/indicator from the car). Restoration is `28 00 03` (cleanup does it, `cleanup.ts:92-95`) or default-session timeout (inferred; ISO 14229 resets comm control on return to default session in most ECUs, not guaranteed).           | Test only parked, never driving. If the lamp stays dark after a test: send `28 00 03` to 0x43/0x44, then `10 01`; else ignition cycle.                                             |
| Fighting FEM         | FEM still sends D542/cyclic requests to the same lamps. Without `28 02 01` the module may blend or override the diagnostic PWM. D542 aggregate functions and LHM2 writes should never run together on the same side.                                                                             | Silence only the modules being written; do not combine with `lowBeamAll` etc.                                                                                                      |
| Wrong DID content    | A malformed 14-byte record could be rejected with NRC 0x13 (length) / 0x31 (range) or, worst case, store a bad current limit (LED overdrive) if the STROM bytes are persisted.                                                                                                                   | Echo read-back current bytes; never invent them; do not write while hot; start with one lamp.                                                                                      |
| FuSi functions       | DIDs 6067/6068 and `A534` exist; keep them out of the app.                                                                                                                                                                                                                                       | Do not generate.                                                                                                                                                                   |
| Thermal / LED stress | 250 PWM full duty on a bulb-off car for long periods.                                                                                                                                                                                                                                            | Cap ON to a few seconds.                                                                                                                                                           |

## 5. Left/right indicators (F32, FEM_20 + REM_20 + KOMB25 + LHM2)

### 5.1 What is sent today

Effects `flash.indicatorLeft` / `flash.indicatorRight` (`src/data/generated/effects.ts:467-493`): steps ON then OFF of `indicatorLeftAll` / `indicatorRightAll`, `clusterFeedback: true`, `requiredModules: ['BDC','FEM_20']`.

| Step                | Module (addr)  | Payload                                                                           |
| ------------------- | -------------- | --------------------------------------------------------------------------------- |
| session             | FEM_20 (0x40)  | `10 03`                                                                           |
| cluster feedback on | KOMB25 (0x60)  | `10 03`, `31 01 F0 12 01 FC 21` (`gen/KOMB25.ts:20-24`, `ecu/KOMB25.json:26`)     |
| left ON             | FEM_20         | `2E D5 42 00 06 00 64` (`gen/FEM_20.ts:147-151`)                                  |
| left OFF            | FEM_20         | `2E D5 42 00 06 00 00`                                                            |
| right ON / OFF      | FEM_20         | `2E D5 42 00 07 00 64` / `... 00 00` (`gen/FEM_20.ts:152-156`)                    |
| cleanup             | FEM_20, KOMB25 | OFF, return control `2F 45 01 00 FE`, cluster off `31 01 F0 12 01 FC 00`, `10 01` |

The ECU mapping describes `STEUERN ARG LEUCHTEN_FUNKTION` elements 0x06/0x07 with a ZEIT parameter (`data/ecu/FEM_20.json:480-505`). The car-level request/reply and visible result for these indicator elements remain unverified.

Hazard that works: `2E D5 42 00 12 00 64` (`gen/FEM_20.ts:202-206`, `ecu/FEM_20.json:620-632`) with the same `clusterFeedback: true` (`effects.ts:2589`). So framing, session, ZEIT size, KOMB25 feedback and FEM addressing are all proven by the hazard; only `ELEMENT 0x0006/0x0007` differs.

NRC: the real code was not captured (PLAN.md:150 "ECU cause remains unverified"; `src/domain/__tests__/nrc-repro.test.ts` uses a fabricated 0x31 only to reproduce the app's behaviour). Plausible values, by likelihood (inference only):

| NRC                       | Meaning                                                   | Why it would fit                                                                                                |
| ------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 0x22 conditionsNotCorrect | ignition/terminal state or turn-stalk source busy         | `docs/PLAN.md:66` already expects 0x22 for "ignition on" cases; direction indicators are driver-input functions |
| 0x31 requestOutOfRange    | ELEMENT value 6/7 not accepted on this FEM variant/coding | hazard (0x12) accepted, so the value range check is per element                                                 |
| 0x33 securityAccessDenied | indicator write guarded                                   | unlikely; no 27 service is documented in the available command mappings                                         |
| 0x7F `78` then drop       | response-pending then link loss                           | would explain "lost the connection"; also could be the app's cleanup path (`PLAN.md:150`)                       |

Get the actual NRC first: the development log records module/element/error for failed light commands (PLAN.md:150). That one byte decides the path.

### 5.2 Alternative paths

Common frame notes: `2F 45 01 03 <id> <state>` expects `6F 45 01 ...`; hold with `3E FF` keepalive; state persists until OFF or return control. Flashing is done by the app, since each request only sets a state: BMW rate is about 1.5 Hz, so ON 350 ms / OFF 350 ms, 3 to 5 cycles; each request RTT must fit in the half period (`runner.ts` already checks step spacing against RTT).

(a) FEM_20 IO control of the individual indicator channels (`ecu/FEM_20.uds.json:224`, enum `:7454`):

| Element in app      | Payload ON / OFF                  | Output                            | Confidence |
| ------------------- | --------------------------------- | --------------------------------- | ---------- |
| frontLeftIndicator  | `2F 45 01 03 0D 01` / `... 0D 00` | FRA_V_L                           | medium-low |
| frontRightIndicator | `2F 45 01 03 0E 01` / `... 0E 00` | FRA_V_R                           | medium-low |
| sideIndicatorLeft   | `2F 45 01 03 10 01` / `... 10 00` | FRA_Z_L (side repeater, "Zusatz") | medium     |
| sideIndicatorRight  | `2F 45 01 03 11 01` / `... 11 00` | FRA_Z_R                           | medium     |

Source: `gen/FEM_20.ts:72-91`, `data/ecu/FEM_20.json:134-170`. Cleanup: `2F 45 01 00 FE` (`gen/FEM_20.ts:9`; mapping `ecu/FEM_20.json:704`), then `10 01`. The front pair is the same class as the lowBeam/highBeam per-side outputs that the car acknowledged but ignored, so on LED headlights FRA_V_L/R may be dead (the indicator is in the headlight and driven through LHM2). FRA_Z (fender/mirror repeaters) is a physical FEM output on cars that have them, so it is more likely real. Mirror indicators: no entry for mirror-integrated indicators in FEM_20's enum or REM_20's; none found.

Rear indicators, per side, REM_20 (0x72), proven channel family on this car (REM brakeLeft/Right lit, `rules.ts:16`): template `2E 45 01 <id> <state>` (`ecu/REM_20.uds.json:4193-4195`, channels FRA_H_L = 0x20 at `:4269`):

| Element            | ON / OFF                                                    | Confidence  |
| ------------------ | ----------------------------------------------------------- | ----------- |
| rearLeftIndicator  | `2E 45 01 20 01` / `2E 45 01 20 00` (`gen/REM_20.ts:72-76`) | medium-high |
| rearRightIndicator | `2E 45 01 21 01` / `2E 45 01 21 00` (`gen/REM_20.ts:77-81`) | medium-high |

REM_20 has no return control (`gen/REM_20.ts:10`, `returnControl: []`): it is a `2E` write, so release is OFF + `10 01`. Effect id exists: `flash.indicatorRearLeft/Right` but `requiredModules` lists `BDC`, `FRM3`, `REM_20` (`effects.ts:578-591`); check how detection treats that on an FEM car.

(b) LHM2 driving the front indicator inside the LED headlight: D5DA proves the headlight reports an indicator (`STAT_FAHRTRICHTUNGSANZEIGE_VERBAU`, `ecu/LHM2_L.uds.json:930`), so on this car the front indicator is a segment of the LHM2 LED matrix. Payload: the section 3 record with the indicator channel at PWM 0xFA/0x00 on 0x43 (left) or 0x44 (right), flashed by the app at 350/350 ms, session `10 03` + `28 02 01`. Which channel: unknown; derive with the read-back test (`22 60 60` while the stalk indicator is on: the channel whose PWM pulses at about 1.5 Hz is the indicator). Confidence: low for the byte values until the mapping is read (medium that the mechanism works). Cleanup: baseline write, `28 00 03`, `10 01`.

(c) D542 with different session or precondition:

- Ignition KL15 on, engine off, lights switch Off, stalk centered, hazard off, doors closed (if NRC 0x22, this is the first thing to try). Confidence medium that this is a precondition problem.
- Read first: `22 D5 42` returns status including `STAT_FUNKTION_BLINKER_LINKS_EIN` / `_RECHTS_EIN` (`ecu/FEM_20.uds.json:4341-4345`); use it as ground truth and as a way to see if the ECU thinks the function is on after a positive write.
- Variants: ZEIT is 2 bytes, unit unknown (`ecu/README.md` "Known gaps"). Try `00 64` (current), then `03 E8`, `FF FF`, `00 00`-style variants only if the NRC is 0x31 on the value; the element ID is the more likely culprit. Do not try `10 02` (programming) or any security access.
- Different first command: when hazard `0x12` is acceptable but 0x06/0x07 are not, the FEM may require the turn-signal request to come from a "stalk" signal rather than a diagnostic function on this coding; no data supports a workaround here. Confidence that a different session helps: low.

### 5.3 Recommendation and fallback order

Per-side semantics in the preset ("left indicator" = left side flashes), no hazard substitution (hazard lights both sides and would be wrong).

1. D542 0x06/0x07 (current), unchanged, but only after the NRC is read and the precondition (KL15 on) is tested. This keeps the real native blink behavior and cluster arrow.
2. If still NRC: composite per-side set sent together, all with the same ON/OFF timing from the app: FEM `2F 45 01 03 0D` (front) + FEM `10` (side) + REM `2E 45 01 20` (rear). Left set = {0x0D, 0x10, REM 0x20}; right set = {0x0E, 0x11, REM 0x21}. The registry already supports multiple targets per element (`rules.ts:17-23`, `targets.ts:21-28`), so this is data/rules, not a new mechanism (code not changed here).
3. LHM2 channel write (b) for the front indicator only if FRA_V is dead (acknowledged, no light) and the channel has been identified.
4. Rear-only (REM 0x20/0x21) as a documented partial fallback if nothing else works.

Never fall back to hazard.

### 5.4 Minimal safe on-car test sequence (all parked, ignition on, engine off, hazards and lights off, stalk neutral)

Stop at the first unexpected NRC; after every group run cleanup (`2F 45 01 00 FE` to 0x40, `10 01` to each touched ECU, `28 00 03` if 28 was used).

1. Connect, `22 F1 50` to 0x40/0x43/0x44/0x60/0x72 (identity); `22 D5 42` to 0x40 and save the response (baseline status).
2. `10 03` to 0x40. Hazard sanity: `2E D5 42 00 12 00 64`, expect `6E D5 42` and flashing, then `2E D5 42 00 12 00 00`. (Known good.)
3. Capture the NRC: `2E D5 42 00 06 00 64`. Record the response byte(s). Then `22 D5 42`.
4. If NRC 0x22: change the precondition (ignition state) and retry step 3. If 0x31: try step 3 on 0x07, and a different ZEIT only if documented.
5. Path (a): `2F 45 01 03 10 01`, look at the fender/mirror, `2F 45 01 03 10 00`, `2F 45 01 00 FE`. Repeat for 0x11, then 0x0D, 0x0E (front). Note each: positive/negative, lit or not.
6. REM_20: `10 03` to 0x72, `2E 45 01 20 01`, observe rear left, `2E 45 01 20 00`; same for 0x21; `10 01`.
7. Path (b), read only first: `22 60 60` on 0x43 and 0x44 in states: lights off, stalk left, stalk right, low beam, high beam. Save the diff. Only then one write at a time: `10 03`, `28 02 01`, baseline-echo write with the identified indicator channel at 0xFA for about 300 ms, baseline write, `28 00 03`, `10 01`. Check the lamp returns to normal behavior with the stalk afterwards, ignition cycle if not.
8. Report back per step: NRC byte, lit or not, whether the cluster arrow reacted, whether the lamp returned to normal.

## Open questions that only the car can answer

1. Actual NRC for D542 0x06/0x07.
2. Whether FRA_V_L/R and FRA_Z_L/R light, or are dead outputs like the LED per-side outputs.
3. LHM2 channel-to-function mapping (read-back) and how the client populates the other 13 bytes.
4. Whether `2E 60 60` needs `28 02 01` and `10 03`, and whether `10 01` alone releases the PWM.
5. Which `3E` keepalive / S3 timeout LHM2 uses (not in the data).
