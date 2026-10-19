# ECU source data

ECU source data for F-series lighting control. Everything the app knows about payload bytes comes from these files; nothing in `src/` or `app/` imports them. Only `scripts/gen-data.ts` reads them.

## Contents

- `<SGBD>.json` mapping rows (vendor command id, function, arguments) and `<SGBD>.uds.json` ECU bundle (address, job templates, function schemas, enums, light maps) for FEM_20, REM_20, FRM3, BDC, FLE02_L, FLE02_R, LHM2_L, LHM2_R, KOMB01, KOMB25.
- `ecu_modules.json` identification table: `ADR_INDEX` and `SGBD_HEX` (the three bytes after `62 F1 50`) to SGBD and chassis.
- Effect packs: `flash`, `headlight_flash`, `headlight_show`, `one_side`, `taillight_flash`, `taillight_show`, `party_mode`, `ghost`, `toggle`.
- `chassis_info.json` filtered to rows whose series label contains an F chassis code (F01 to F98, including M models).

## Regenerate

```
pnpm gen:data     # validate with zod and emit src/data/generated
pnpm gen:data:check
```

Optional data import: set `ECU_SOURCE_DIR` to a directory containing the source JSON files, then run `pnpm sync:data`. Normal builds use the tracked files and do not require this step.

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

## Dropped effect actions (not available on F modules)

Eight toggle pairs and three flash actions are dropped on purpose. Their commands exist only in the G-series modules BCP_SP21, BDC_G05 and BDC_G11, never in the ten F modules in this folder, so there is nothing to map to an `ElementId` and no bytes to take from the data:

| Command | Function id (`2E D5 42 <id>`) | Modules carrying it | Used by |
| --- | --- | --- | --- |
| `LOCATOR_AND_FUNCTIONAL_LIGHTING` | `0x15` | BDC_G05, BDC_G11 | toggle Locator Light |
| `FOLLOW_ME_HOME` | `0x16` | BCP_SP21, BDC_G05 | toggle Follow Me Home |
| `ANNOUNCEMENT_INDICATOR_LIGHT` | `0x17` | BCP_SP21, BDC_G05 | toggle Announcement Indicator |
| `MANEUVRING_LIGHT` | `0x18` | BCP_SP21, BDC_G05 | toggle Maneuvring Light |
| `OVT` | `0x19` | BCP_SP21, BDC_G05, BDC_G11 | flash Ovt |
| `REMOTE_LIGHT` | `0x1A` | BCP_SP21, BDC_G05 | toggle Remote Light |
| `REVERSING_FLASH` | `0x1B` | BCP_SP21, BDC_G05 | flash Reversing Flash |
| `SPECIAL_FUNCTION_FLASHING` | `0x1C` | BCP_SP21, BDC_G05 | toggle Special Function |
| `GOODBYE_LIGHT` | `0x1E` | BCP_SP21, BDC_G05 | toggle Goodbye Light |
| `BUNCH_LIGHT` | `0x1F` | BCP_SP21, BDC_G05 | toggle Bunch Light, flash Bunch |

On FEM_20 and BDC the `TAB_LAMPEN_FUNKTION` enum used by `LEUCHTEN_FUNKTION` (`D542`) ends at `0x13` (Innenbeleuchtung), then `0xFF`. The ids above are undefined there, so sending them would be guessing. Keeping them as direct module commands was rejected for the same reason: the F modules have no row for them. The packs also address them to the CAS group, which only G-series BDC/BCP rows define. If an F module's data ever gains these rows, add them to `ELEMENT_MAP` with a category.

Kept toggle pairs: Hazard (`0x12`), Brake Force (`0x0D`) and Welcome Light (FRM3 `VFB`), all present in the F modules.
