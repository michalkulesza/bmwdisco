# Controllable lamp elements: F32 FEM_20 and F10 FRM3

All paths relative to analysis/ (decrypted/FEM_20.json etc.). Static evidence only; nothing observed on a car except the CONTRACT.md:81 `2E D5 42` write.

## 1. Derivation (once)

F32 FEM_20 (addr 0x40, decrypted/FEM_20.uds.json:3 addr). Digital outputs, job template (FEM_20.uds.json:139):
`"STEUERN_LEUCHTENAUSGANG_DIGITAL": "2f4501030000"` = `2F 45 01 03 00 00` (IOControl, DID 4501, STA=03). Function schema at FEM_20.uds.json:222-235: id `4501`, args ELEMENT (1 byte, enum `TAB_DEV_AUSGANG_LEUCHTEN`, FEM_20.uds.json:7454-7490) and AKTION (1 byte). Mapping rows (FEM_20.json) give `args: ["0x<ch>", "{param_aktion}"]`; packs supply param_aktion 1 on / 0 off (command-findings.md:30). Assembly (CONTRACT.md section 3(b) Form B): base bytes, strip trailing zero bytes equal to len(args), append args. Result: `2F 45 01 03 <ch> <01|00>`. Verify with existing: FRA_V_L ch 0x0D (FEM_20.json:137; enum :7467) -> `2F 45 01 03 0D 01`, matches profiles.ts.
Return control (FEM_20.json:704 row RETURN_CONTROL): `2F 45 01 00 FE`.

F32 aggregate "light function" shape (different from digital): mapping rows FEM_20.json:402-649 use `function STEUERN`, args `["ARG","LEUCHTEN_FUNKTION","0x<el>","{param_zeit}"]`. Dispatch (CONTRACT.md section 3(c) ARG-dispatch) -> fn `LEUCHTEN_FUNKTION` service 0x2E, DID `D542`, fields ELEMENT (2 bytes, enum TAB_LAMPEN_FUNKTION, FEM_20.uds.json:4285-4297, :8275) and ZEIT (2 bytes). Result `2E D5 42 <el hi> <el lo> <zeit hi> <zeit lo>`; packs: zeit 100 on, 0 off. Example `2E D5 42 00 05 00 64` (HIGH_BEAM) is the live-car-confirmed frame (CONTRACT.md:81; command-findings.md:57). Semantics differ: WriteDataByIdentifier not IOControl, "time" field (unit unknown, likely auto-expiring), element is 16-bit, off = time 0 (not an STA off), and `2F 45 01 00 FE` return-control is not documented to cancel it.

F10 FRM3 (addr 0x72, FRM3.uds.json:3). Lights map (FRM3.uds.json:3238-3240): function STEUERN_DIGITAL_LICHT, template `2F 01 00 03 00`, `channels.<name> = [[2, idx]]` (OR idx into byte 2, lines 3242-3489), `state.on=[[4,0x64]]`, `state.off=[]` (FRM3.uds.json:3490-3497). Result `2F 01 <idx> 03 <64|00>`. Mapping rows in FRM3.json (description line cited per element). No RETURN_CONTROL row; rely on OFF + `10 01`.

Confidence: high = byte string straight from data and element role unambiguous (or vendor example / existing profile); medium = bytes from data, lamp presence/behaviour on an actual car not provable; low = suspicious data (empty channel, coding-dependent, unlabelled). F10 identity itself is inferred (f10-findings.md:1-18).

## 2. Per-element table

Cite format: FEM_20.json:<mapping line>; uds:<enum line in FEM_20.uds.json>. FRM3.json:<mapping line>; uds:<channel line in FRM3.uds.json>.

| id | label | group | F32 on / off | F32 conf | F32 cite | F10 on / off | F10 conf | F10 cite | notes |
|---|---|---|---|---|---|---|---|---|---|
| lowBeamLeft | Low beam left | Front | `2F 45 01 03 01 01` / `2F 45 01 03 01 00` | high | FEM_20.json:5 (AL_L); uds:7455 | `2F 01 04 03 64` / `2F 01 04 03 00` | high | FRM3.json:49; uds:3261 (AL_L) |  |
| lowBeamRight | Low beam right | Front | `2F 45 01 03 02 01` / `2F 45 01 03 02 00` | high | FEM_20.json:16 (AL_R); uds:7456 | `2F 01 05 03 64` / `2F 01 05 03 00` | high | FRM3.json:60; uds:3267 (AL_R) |  |
| highBeamLeft | High beam left | Front | `2F 45 01 03 07 01` / `2F 45 01 03 07 00` | high | FEM_20.json:71 (FL_L); uds:7461 | `2F 01 0B 03 64` / `2F 01 0B 03 00` | medium | FRM3.json:126; uds:3303 (FL_L) | F10: halogen high beam / xenon cornering (FRM3.json:126) |
| highBeamRight | High beam right | Front | `2F 45 01 03 08 01` / `2F 45 01 03 08 00` | high | FEM_20.json:82 (FL_R); uds:7462 | `2F 01 0C 03 64` / `2F 01 0C 03 00` | medium | FRM3.json:137; uds:3309 (FL_R) |  |
| daytimeLeft | Daytime running light left | Front | `2F 45 01 03 03 01` / `2F 45 01 03 03 00` | high | FEM_20.json:27 (TFL_L); uds:7457 | `2F 01 13 03 64` / `2F 01 13 03 00` | medium | FRM3.json:214; uds:3351 (TFL_L) | F10 desc: position (halogen) / DRL (xenon) |
| daytimeRight | Daytime running light right | Front | `2F 45 01 03 04 01` / `2F 45 01 03 04 00` | high | FEM_20.json:38 (TFL_R); uds:7458 | `2F 01 14 03 64` / `2F 01 14 03 00` | medium | FRM3.json:225; uds:3357 (TFL_R) |  |
| positionLeft | Position light left | Front | `2F 45 01 03 09 01` / `2F 45 01 03 09 00` | medium | FEM_20.json:93 (POL_L); uds:7463 | `2F 01 13 03 64` / `2F 01 13 03 00` | medium | FRM3.json:236; uds:3363 (POS_L) | F10 POS_L shares channel 0x13 with TFL_L (same output as daytimeLeft) |
| positionRight | Position light right | Front | `2F 45 01 03 0A 01` / `2F 45 01 03 0A 00` | medium | FEM_20.json:104 (POL_R); uds:7464 | `2F 01 14 03 64` / `2F 01 14 03 00` | medium | FRM3.json:247; uds:3369 (POS_R) | F10 POS_R shares channel 0x14 with TFL_R |
| sideMarkerFrontLeft | Front side marker left | Front | `2F 45 01 03 05 01` / `2F 45 01 03 05 00` | medium | FEM_20.json:49 (SML_L); uds:7459 | `2F 01 17 03 64` / `2F 01 17 03 00` | medium | FRM3.json:280; uds:3387 (SML_V_L) |  |
| sideMarkerFrontRight | Front side marker right | Front | `2F 45 01 03 06 01` / `2F 45 01 03 06 00` | medium | FEM_20.json:60 (SML_R); uds:7460 | `2F 01 18 03 64` / `2F 01 18 03 00` | medium | FRM3.json:291; uds:3393 (SML_V_R) |  |
| frontFogLeft | Front fog left | Fog | `2F 45 01 03 0B 01` / `2F 45 01 03 0B 00` | medium | FEM_20.json:115 (NSW_L); uds:7465 | `2F 01 11 03 64` / `2F 01 11 03 00` | medium | FRM3.json:192; uds:3339 (NSW_L) | optional equipment |
| frontFogRight | Front fog right | Fog | `2F 45 01 03 0C 01` / `2F 45 01 03 0C 00` | medium | FEM_20.json:126 (NSW_R); uds:7466 | `2F 01 12 03 64` / `2F 01 12 03 00` | medium | FRM3.json:203; uds:3345 (NSW_R) | optional equipment |
| rearFogLeft | Rear fog left | Fog | n/a | n/a |  | `2F 01 0F 03 64` / `2F 01 0F 03 00` | medium | FRM3.json:170; uds:3327 (NSL_L) | F10 usually fitted one side only |
| rearFogRight | Rear fog right | Fog | n/a | n/a |  | `2F 01 10 03 64` / `2F 01 10 03 00` | medium | FRM3.json:181; uds:3333 (NSL_R) |  |
| rearFogBoth | Rear fog (both, aggregate) | Fog | `2E D5 42 00 0E 00 64` / `2E D5 42 00 0E 00 00` | medium | FEM_20.json:571 (FOG_REAR, el 0x0E) | n/a | n/a |  | F32 aggregate D542 shape |
| frontLeftIndicator | Front indicator left | Indicators | `2F 45 01 03 0D 01` / `2F 45 01 03 0D 00` | high | FEM_20.json:137 (FRA_V_L); uds:7467 | `2F 01 1C 03 64` / `2F 01 1C 03 00` | high | FRM3.json:324; uds:3411 (FRA_V_L) |  |
| frontRightIndicator | Front indicator right | Indicators | `2F 45 01 03 0E 01` / `2F 45 01 03 0E 00` | high | FEM_20.json:148 (FRA_V_R); uds:7468 | `2F 01 1D 03 64` / `2F 01 1D 03 00` | high | FRM3.json:335; uds:3417 (FRA_V_R) |  |
| sideIndicatorLeft | Side repeater left | Indicators | `2F 45 01 03 10 01` / `2F 45 01 03 10 00` | medium | FEM_20.json:159 (FRA_Z_L); uds:7469 | n/a | n/a |  |  |
| sideIndicatorRight | Side repeater right | Indicators | `2F 45 01 03 11 01` / `2F 45 01 03 11 00` | medium | FEM_20.json:170 (FRA_Z_R); uds:7470 | n/a | n/a |  |  |
| rearLeftIndicator | Rear indicator left | Indicators | n/a | n/a |  | `2F 01 1A 03 64` / `2F 01 1A 03 00` | medium | FRM3.json:302; uds:3399 (FRA_H_L) |  |
| rearRightIndicator | Rear indicator right | Indicators | n/a | n/a |  | `2F 01 1B 03 64` / `2F 01 1B 03 00` | medium | FRM3.json:313; uds:3405 (FRA_H_R) |  |
| indicatorLeftAll | Left indicators (all, aggregate) | Indicators | `2E D5 42 00 06 00 64` / `2E D5 42 00 06 00 00` | medium | FEM_20.json:480 (INDICATOR_LEFT, el 0x06) | n/a | n/a |  | F32 aggregate D542 shape; includes rear |
| indicatorRightAll | Right indicators (all, aggregate) | Indicators | `2E D5 42 00 07 00 64` / `2E D5 42 00 07 00 00` | medium | FEM_20.json:493 (INDICATOR_RIGHT, el 0x07) | n/a | n/a |  |  |
| hazard | Hazard flashers (aggregate) | Indicators | `2E D5 42 00 12 00 64` / `2E D5 42 00 12 00 00` | medium | FEM_20.json:623 (HAZARD, el 0x12) | n/a | n/a |  |  |
| tailLeft | Tail light left (outer) | Rear | n/a | n/a |  | `2F 01 02 03 64` / `2F 01 02 03 00` | medium | FRM3.json:27; uds:3249 (SL_A_L) |  |
| tailRight | Tail light right (outer) | Rear | n/a | n/a |  | `2F 01 03 03 64` / `2F 01 03 03 00` | medium | FRM3.json:38; uds:3255 (SL_A_R) |  |
| tailInnerRight | Tail light right (boot lid) | Rear | n/a | n/a |  | `2F 01 01 03 64` / `2F 01 01 03 00` | low | FRM3.json:16; uds:3243 (SL_I_R) | F10 SL_I_L channel list empty -> asymmetric, suspicious |
| brakeLeft | Brake light left | Rear | n/a | n/a |  | `2F 01 06 03 64` / `2F 01 06 03 00` | medium | FRM3.json:71; uds:3273 (BL_L) |  |
| brakeCenter | Brake light centre (CHMSL) | Rear | n/a | n/a |  | `2F 01 07 03 64` / `2F 01 07 03 00` | medium | FRM3.json:82; uds:3279 (BL_M) |  |
| brakeRight | Brake light right | Rear | n/a | n/a |  | `2F 01 08 03 64` / `2F 01 08 03 00` | medium | FRM3.json:93; uds:3285 (BL_R) |  |
| brakeAll | Brake lights (all, aggregate) | Rear | `2E D5 42 00 0C 00 64` / `2E D5 42 00 0C 00 00` | medium | FEM_20.json:545 (BRAKE, el 0x0C) | n/a | n/a |  | F32 aggregate D542 shape |
| brakeForceDisplay | Brake force display / ESS (aggregate) | Rear | `2E D5 42 00 0D 00 64` / `2E D5 42 00 0D 00 00` | medium | FEM_20.json:558 (BFD, el 0x0D) | n/a | n/a |  | F32 aggregate; emergency-stop signalling |
| reverseLeft | Reverse light left | Rear | n/a | n/a |  | `2F 01 15 03 64` / `2F 01 15 03 00` | medium | FRM3.json:258; uds:3375 (RFL_L) |  |
| reverseRight | Reverse light right | Rear | n/a | n/a |  | `2F 01 16 03 64` / `2F 01 16 03 00` | medium | FRM3.json:269; uds:3381 (RFL_R) |  |
| reverseBoth | Reverse lights (both, aggregate) | Rear | `2E D5 42 00 0F 00 64` / `2E D5 42 00 0F 00 00` | medium | FEM_20.json:584 (REVERSE, el 0x0F) | n/a | n/a |  | F32 aggregate D542 shape |
| licensePlate | Licence plate light | Rear | n/a | n/a |  | `2F 01 0E 03 64` / `2F 01 0E 03 00` | medium | FRM3.json:159; uds:3321 (KZL) |  |
| parkingLights | Parking lights (all, aggregate) | Front | `2E D5 42 00 01 00 64` / `2E D5 42 00 01 00 00` | medium | FEM_20.json:415 (Standlicht, el 0x01) | n/a | n/a |  | F32 aggregate (Standlicht, element 1); includes tails |
| parkLightLeft | Parking light left side (aggregate) | Front | `2E D5 42 00 10 00 64` / `2E D5 42 00 10 00 00` | medium | FEM_20.json:597 (PARK_LEFT, el 0x10) | n/a | n/a |  | F32 one-sided parking light, both ends |
| parkLightRight | Parking light right side (aggregate) | Front | `2E D5 42 00 11 00 64` / `2E D5 42 00 11 00 00` | medium | FEM_20.json:610 (PARK_RIGHT, el 0x11) | n/a | n/a |  |  |
| hazardLed | Hazard button LED | Interior | `2F 45 01 03 26 01` / `2F 45 01 03 26 00` | medium | FEM_20.json:203 (WBL_LED); uds:7473 | `2F 01 1E 03 64` / `2F 01 1E 03 00` | low | FRM3.json:346; uds:3423 (LED_WBL) |  |
| interiorFront | Interior light | Interior | `2E D5 42 00 13 00 64` / `2E D5 42 00 13 00 00` | medium | FEM_20.json:636 (INTERIOR, el 0x13) | `2F 01 1F 03 64` / `2F 01 1F 03 00` | low | FRM3.json:357; uds:3429 (IB_IL) | F32 aggregate D542 shape |
| interiorRear | Rear interior light | Interior | n/a | n/a |  | `2F 01 0A 03 64` / `2F 01 0A 03 00` | low | FRM3.json:115; uds:3297 (IB_IL_2) |  |
| footwellFront | Footwell/door light front | Interior | `2F 45 01 03 2A 01` / `2F 45 01 03 2A 00` | medium | FEM_20.json:247 (LCI_3); uds:7477 | n/a | n/a |  | LCI output; function is coding-dependent (INNENLICHT_MAPPING D5DE) |
| footwellRear | Footwell/door light rear | Interior | `2F 45 01 03 2B 01` / `2F 45 01 03 2B 00` | medium | FEM_20.json:258 (LCI_4); uds:7478 | n/a | n/a |  |  |
| doorHandle | Door handle light | Interior | `2F 45 01 03 2C 01` / `2F 45 01 03 2C 00` | medium | FEM_20.json:269 (LCI_5); uds:7479 | n/a | n/a |  |  |
| ambient | Ambient light | Interior | `2F 45 01 03 2D 01` / `2F 45 01 03 2D 00` | medium | FEM_20.json:280 (LCI_6); uds:7480 | `2F 01 26 03 64` / `2F 01 26 03 00` | low | FRM3.json:390; uds:3447 (AMB1) | F10 also AMB2 (0x27) low |
| welcome | Welcome / apron light | Interior | n/a | n/a |  | `2F 01 22 03 64` / `2F 01 22 03 00` | low | FRM3.json:379; uds:3441 (VFB) |  |
| terminal58g | Dimmed terminal 58g | Interior | n/a | n/a |  | `2F 01 20 03 64` / `2F 01 20 03 00` | low | FRM3.json:368; uds:3435 (KL_58G) |  |
| doorWarning | Door warning light | Interior | n/a | n/a |  | `2F 01 32 03 64` / `2F 01 32 03 00` | low | FRM3.json:423; uds:3465 (TWL) |  |

## 3. Odd shapes and flagged semantics

1. FEM_20 aggregate elements (`2E D5 42 00 <el> 00 <time>`): brakeAll (0C), brakeForceDisplay (0D), rearFogBoth (0E), reverseBoth (0F), parkLightLeft/Right (10/11), hazard (12), interiorFront (13), indicatorLeftAll/RightAll (06/07), parkingLights (01). These are the ONLY FEM_20 route to rear lamps: FEM_20 TAB_DEV_AUSGANG_LEUCHTEN (FEM_20.uds.json:7454-7490) has no rear outputs (no SL/BL/NSL/RFS/FRA_H/KZL). Both sides at once, no L/R. Time field `00 64` on, `00 00` off; time unit unknown (may auto-expire, so keepalive/re-send may be needed). Shape confirmed on a live car only for element 05 (CONTRACT.md:81).
2. Digital FEM_20 OFF (`... 00`) forces the output off (STA 0) rather than releasing it. Low beam / DRL / indicators stay forced off until `2F 45 01 00 FE` (RETURN_CONTROL, FEM_20.json:704) or session end. Always send return control at the end.
3. FRM3 on = 0x64 (not 0x01) for every channel; no PWM variants exist in the lights map. No return control; off = `00` then `10 01`.
4. F10 POS_L/POS_R alias TFL_L/TFL_R (same channel 0x13/0x14, FRM3.uds.json:3363-3374), so positionX and daytimeX are the same physical output on F10.
5. REM_20 (rear module, addr 0x72, ident `62 F1 50 0F 16 C0`) uses `2E 45 01 <ch> <01|00>` (WriteDataByIdentifier, no `03`, template `2E 45 01 00 00`, REM_20.uds.json:4193-4299). Only listed for BAUREIHE F20 (ecu_modules.json:2817-2822); whether an F32 has it is unknown. Low confidence for F32; not in the TS table. Channels: SL_L 14, SL_R 15, SL_2_L 16, SL_2_R 17, BL_L 18, BL_R 19, BFD_L 1A, BFD_R 1B, NSL_L 1C, NSL_R 1D, RFS_L 1E, RFS_R 1F, FRA_H_L 20, FRA_H_R 21, KZL 22, BL_M 23 (REM_20.uds.json:4197-4287; mapping REM_20.json:5-170). On `...01`, off `...00`. Includes licence plate and brake centre; if the car has it, it gives per-lamp rear control missing from FEM_20.

## 4. Exclusions

- Not lamps / motors / flaps: BIX_L/R (FEM ch 0x12/0x13, FEM_20.json:181-192) and BI_XENON_L_R (FRM3 0x0D), KL_VA (0x09, terminal), UBATT_TMS_L/R (supply).
- Negative-response per data: FRM3 ABBL_L/R (cornering) and BL_L_2/R_2 have mapping rows but no channel entries (FRM3.json:434-445, 489-500; CONTRACT.md:143), exposing them yields NRC. FRM3 XX placeholder (FRM3.json:511). FEM_20 UNGUELTIG 0xFF (FEM_20.json:390), INVALID aggregate 0xFF (:649), NONE (:402).
- FEM_20 ALLE `2F 45 01 03 FE 01` (FEM_20.json:379): all outputs at once; not an element (useful as "all on/off").
- FEM_20 TMS_LEUCHTRING_L/R (0x30/31), TMS_SML_L/R (0x32/33), TMS_DESIGN_L/R (0x34/35), LCI_0/1/2/7/8 (0x27-0x29, 0x2E, 0x2F): real outputs but the mapping gives them no command name (empty `command`, FEM_20.json:313-368, 214-236, 291-302); function coding-dependent -> low, excluded.
- FRM3 second indicator outputs FRA_V_L_2/R_2 (0x36/0x37, FRM3.json:467-478), F12/F13 only: low for F10. FRM3 SL_I_L (empty channels, FRM3.uds.json:3242).
- FEM_20 aggregates with L/R duplicates already covered per-lamp (LOW_BEAM, HIGH_BEAM, DAYTIME, POSITION_ES, FOG_FRONT, CORNERING_LEFT/RIGHT FEM_20.json:441-532) not listed; CORNERING low (equipment dependent).
- Interior F10 entries (hazardLed, interiorFront, interiorRear, ambient, welcome, terminal58g, doorWarning) rated low in f10-findings.md section 5; listed above but excluded from the TS table.

## 5. TypeScript table (medium/high only)

```ts
export interface LampElementDef {
  id: string;
  label: string;
  group: 'Front' | 'Fog' | 'Indicators' | 'Rear' | 'Interior';
  f32?: { on: string; off: string };
  f10?: { on: string; off: string };
}

export const LAMP_ELEMENTS: LampElementDef[] = [
  { id: 'lowBeamLeft', label: 'Low beam left', group: 'Front', f32: { on: '2F 45 01 03 01 01', off: '2F 45 01 03 01 00' }, f10: { on: '2F 01 04 03 64', off: '2F 01 04 03 00' } },
  { id: 'lowBeamRight', label: 'Low beam right', group: 'Front', f32: { on: '2F 45 01 03 02 01', off: '2F 45 01 03 02 00' }, f10: { on: '2F 01 05 03 64', off: '2F 01 05 03 00' } },
  { id: 'highBeamLeft', label: 'High beam left', group: 'Front', f32: { on: '2F 45 01 03 07 01', off: '2F 45 01 03 07 00' }, f10: { on: '2F 01 0B 03 64', off: '2F 01 0B 03 00' } },
  { id: 'highBeamRight', label: 'High beam right', group: 'Front', f32: { on: '2F 45 01 03 08 01', off: '2F 45 01 03 08 00' }, f10: { on: '2F 01 0C 03 64', off: '2F 01 0C 03 00' } },
  { id: 'daytimeLeft', label: 'Daytime running light left', group: 'Front', f32: { on: '2F 45 01 03 03 01', off: '2F 45 01 03 03 00' }, f10: { on: '2F 01 13 03 64', off: '2F 01 13 03 00' } },
  { id: 'daytimeRight', label: 'Daytime running light right', group: 'Front', f32: { on: '2F 45 01 03 04 01', off: '2F 45 01 03 04 00' }, f10: { on: '2F 01 14 03 64', off: '2F 01 14 03 00' } },
  { id: 'positionLeft', label: 'Position light left', group: 'Front', f32: { on: '2F 45 01 03 09 01', off: '2F 45 01 03 09 00' }, f10: { on: '2F 01 13 03 64', off: '2F 01 13 03 00' } },
  { id: 'positionRight', label: 'Position light right', group: 'Front', f32: { on: '2F 45 01 03 0A 01', off: '2F 45 01 03 0A 00' }, f10: { on: '2F 01 14 03 64', off: '2F 01 14 03 00' } },
  { id: 'sideMarkerFrontLeft', label: 'Front side marker left', group: 'Front', f32: { on: '2F 45 01 03 05 01', off: '2F 45 01 03 05 00' }, f10: { on: '2F 01 17 03 64', off: '2F 01 17 03 00' } },
  { id: 'sideMarkerFrontRight', label: 'Front side marker right', group: 'Front', f32: { on: '2F 45 01 03 06 01', off: '2F 45 01 03 06 00' }, f10: { on: '2F 01 18 03 64', off: '2F 01 18 03 00' } },
  { id: 'frontFogLeft', label: 'Front fog left', group: 'Fog', f32: { on: '2F 45 01 03 0B 01', off: '2F 45 01 03 0B 00' }, f10: { on: '2F 01 11 03 64', off: '2F 01 11 03 00' } },
  { id: 'frontFogRight', label: 'Front fog right', group: 'Fog', f32: { on: '2F 45 01 03 0C 01', off: '2F 45 01 03 0C 00' }, f10: { on: '2F 01 12 03 64', off: '2F 01 12 03 00' } },
  { id: 'rearFogLeft', label: 'Rear fog left', group: 'Fog', f10: { on: '2F 01 0F 03 64', off: '2F 01 0F 03 00' } },
  { id: 'rearFogRight', label: 'Rear fog right', group: 'Fog', f10: { on: '2F 01 10 03 64', off: '2F 01 10 03 00' } },
  { id: 'rearFogBoth', label: 'Rear fog (both, aggregate)', group: 'Fog', f32: { on: '2E D5 42 00 0E 00 64', off: '2E D5 42 00 0E 00 00' } },
  { id: 'frontLeftIndicator', label: 'Front indicator left', group: 'Indicators', f32: { on: '2F 45 01 03 0D 01', off: '2F 45 01 03 0D 00' }, f10: { on: '2F 01 1C 03 64', off: '2F 01 1C 03 00' } },
  { id: 'frontRightIndicator', label: 'Front indicator right', group: 'Indicators', f32: { on: '2F 45 01 03 0E 01', off: '2F 45 01 03 0E 00' }, f10: { on: '2F 01 1D 03 64', off: '2F 01 1D 03 00' } },
  { id: 'sideIndicatorLeft', label: 'Side repeater left', group: 'Indicators', f32: { on: '2F 45 01 03 10 01', off: '2F 45 01 03 10 00' } },
  { id: 'sideIndicatorRight', label: 'Side repeater right', group: 'Indicators', f32: { on: '2F 45 01 03 11 01', off: '2F 45 01 03 11 00' } },
  { id: 'rearLeftIndicator', label: 'Rear indicator left', group: 'Indicators', f10: { on: '2F 01 1A 03 64', off: '2F 01 1A 03 00' } },
  { id: 'rearRightIndicator', label: 'Rear indicator right', group: 'Indicators', f10: { on: '2F 01 1B 03 64', off: '2F 01 1B 03 00' } },
  { id: 'indicatorLeftAll', label: 'Left indicators (all, aggregate)', group: 'Indicators', f32: { on: '2E D5 42 00 06 00 64', off: '2E D5 42 00 06 00 00' } },
  { id: 'indicatorRightAll', label: 'Right indicators (all, aggregate)', group: 'Indicators', f32: { on: '2E D5 42 00 07 00 64', off: '2E D5 42 00 07 00 00' } },
  { id: 'hazard', label: 'Hazard flashers (aggregate)', group: 'Indicators', f32: { on: '2E D5 42 00 12 00 64', off: '2E D5 42 00 12 00 00' } },
  { id: 'tailLeft', label: 'Tail light left (outer)', group: 'Rear', f10: { on: '2F 01 02 03 64', off: '2F 01 02 03 00' } },
  { id: 'tailRight', label: 'Tail light right (outer)', group: 'Rear', f10: { on: '2F 01 03 03 64', off: '2F 01 03 03 00' } },
  { id: 'brakeLeft', label: 'Brake light left', group: 'Rear', f10: { on: '2F 01 06 03 64', off: '2F 01 06 03 00' } },
  { id: 'brakeCenter', label: 'Brake light centre (CHMSL)', group: 'Rear', f10: { on: '2F 01 07 03 64', off: '2F 01 07 03 00' } },
  { id: 'brakeRight', label: 'Brake light right', group: 'Rear', f10: { on: '2F 01 08 03 64', off: '2F 01 08 03 00' } },
  { id: 'brakeAll', label: 'Brake lights (all, aggregate)', group: 'Rear', f32: { on: '2E D5 42 00 0C 00 64', off: '2E D5 42 00 0C 00 00' } },
  { id: 'brakeForceDisplay', label: 'Brake force display / ESS (aggregate)', group: 'Rear', f32: { on: '2E D5 42 00 0D 00 64', off: '2E D5 42 00 0D 00 00' } },
  { id: 'reverseLeft', label: 'Reverse light left', group: 'Rear', f10: { on: '2F 01 15 03 64', off: '2F 01 15 03 00' } },
  { id: 'reverseRight', label: 'Reverse light right', group: 'Rear', f10: { on: '2F 01 16 03 64', off: '2F 01 16 03 00' } },
  { id: 'reverseBoth', label: 'Reverse lights (both, aggregate)', group: 'Rear', f32: { on: '2E D5 42 00 0F 00 64', off: '2E D5 42 00 0F 00 00' } },
  { id: 'licensePlate', label: 'Licence plate light', group: 'Rear', f10: { on: '2F 01 0E 03 64', off: '2F 01 0E 03 00' } },
  { id: 'parkingLights', label: 'Parking lights (all, aggregate)', group: 'Front', f32: { on: '2E D5 42 00 01 00 64', off: '2E D5 42 00 01 00 00' } },
  { id: 'parkLightLeft', label: 'Parking light left side (aggregate)', group: 'Front', f32: { on: '2E D5 42 00 10 00 64', off: '2E D5 42 00 10 00 00' } },
  { id: 'parkLightRight', label: 'Parking light right side (aggregate)', group: 'Front', f32: { on: '2E D5 42 00 11 00 64', off: '2E D5 42 00 11 00 00' } },
  { id: 'hazardLed', label: 'Hazard button LED', group: 'Interior', f32: { on: '2F 45 01 03 26 01', off: '2F 45 01 03 26 00' } },
  { id: 'interiorFront', label: 'Interior light', group: 'Interior', f32: { on: '2E D5 42 00 13 00 64', off: '2E D5 42 00 13 00 00' } },
  { id: 'footwellFront', label: 'Footwell/door light front', group: 'Interior', f32: { on: '2F 45 01 03 2A 01', off: '2F 45 01 03 2A 00' } },
  { id: 'footwellRear', label: 'Footwell/door light rear', group: 'Interior', f32: { on: '2F 45 01 03 2B 01', off: '2F 45 01 03 2B 00' } },
  { id: 'doorHandle', label: 'Door handle light', group: 'Interior', f32: { on: '2F 45 01 03 2C 01', off: '2F 45 01 03 2C 00' } },
  { id: 'ambient', label: 'Ambient light', group: 'Interior', f32: { on: '2F 45 01 03 2D 01', off: '2F 45 01 03 2D 00' } },
];
```
