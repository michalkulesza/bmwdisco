# ECU source data

source ECU source data for F-series lighting control (see `PROTO/analysis`, local only). Everything the app knows about payload bytes comes from these files; nothing in `src/` or `app/` imports them. Only `scripts/gen-data.ts` reads them.

## Contents

- `<SGBD>.json` mapping rows (vendor command id, function, arguments) and `<SGBD>.uds.json` ECU bundle (address, job templates, function schemas, enums, light maps) for FEM_20, REM_20, FRM3, BDC, FLE02_L, FLE02_R, LHM2_L, LHM2_R, KOMB01, KOMB25.
- `ecu_modules.json` identification table: `ADR_INDEX` and `SGBD_HEX` (the three bytes after `62 F1 50`) to SGBD and chassis.
- Effect packs: `flash`, `headlight_flash`, `headlight_show`, `one_side`, `taillight_flash`, `taillight_show`, `party_mode`, `ghost`, `toggle`.
- `chassis_info.json` filtered to rows whose series label contains an F chassis code (F01 to F98, including M models).

## Regenerate

```
npm run sync:data    # copy from data/ecu (needs the local PROTO folder)
npm run gen:data     # validate with zod and emit src/data/generated
npm run gen:data:check
```

`gen:data:check` regenerates in memory and fails when `src/data/generated` differs; CI runs it after lint.

## Known gaps

- LHM2_L and LHM2_R: the channel routine writes one 14-field record (7 brightness plus 7 current values) while each mapping row names a single field. The data does not say how the remaining fields are filled, so no LHM2 element is generated (`elements` is empty). FLE02 covers the F20 headlights meanwhile.
- FRM3 `SL_I_L` (inner tail light left) has an empty channel list while `SL_I_R` does not. `tailInnerLeft` is not generated for FRM3, `tailInnerRight` is (low confidence).
- FRM3 `BL_L_2`, `BL_R_2`, `ABBL_L`, `ABBL_R` have mapping rows but no channel entries (the ECU answers with a negative response). They are not generated.
- FRM3 `POS_L`/`POS_R` share channels `0x13`/`0x14` with `TFL_L`/`TFL_R`, so `positionLeft` and `daytimeLeft` are the same physical output on F10.
- FEM_20 and BDC aggregate light functions (`2E D5 42 ...`): the time field unit is unknown; only the `HIGH_BEAM` frame is confirmed by the vendor.
- Bi-xenon flaps, `LCI_*`, TMS outputs, PDC/HDC LEDs and other unnamed outputs are kept in `commands` (when named) but are not exposed as elements.
- FLE02 `STOP_ROUTINE` (`31 02 A5 43`) is exposed as a command only; whether it stops every LED routine is unverified, so it is not listed as return control.
- Rear light modules (RLM/RLM2) are not in scope, so all `taillight_flash` actions are dropped.
- The F32 chassis has no row in `ecu_modules.json` (FEM_20 is listed under F20); `SERIES_HINTS` is therefore sparse and only a hint.
- Pack actions carry no timing. Steps are ordered ticks; the show runner decides the interval.
