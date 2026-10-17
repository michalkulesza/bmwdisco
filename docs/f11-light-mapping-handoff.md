# F11 lighting mapping: handoff for BimmerLight source inspection

Date: 2026-10-17. Read `docs/PLAN.md` first for project decisions and safety policy. This file records the conversation and the precise open question so work can resume on the computer with the BimmerLight reference files. `PROTO/` is gitignored and **absent in the workspace used for this handoff**; do not treat guesses about its implementation as findings.

## User report and intended behavior

- Real F11 test detected **FRM3** and **KOMB01**. Indicators did not work (the report does not establish whether a combined tile, an individual output, or both were tried). The seed **Double flash** preset said it would not work on the car.
- The user wants presets to express logical actions such as `indicators left`, `both headlights`, and `headlight left`. A resolver should choose one or more ECU commands for those actions based on the detected car.
- Critical correction from the user: **FRM3 can be present with halogen or xenon headlights. FRM3 detection by itself cannot choose the correct high-beam implementation.** Find out whether and how BimmerLight distinguishes these variants, then design BimmerDisco's resolver accordingly.

## Findings from this repository (code/data, not car validation)

- `src/domain/registry/detect-car.ts` probes `22 F1 50` for known modules and reads `22 F1 90` VIN. `src/domain/registry/helpers.ts` uses VIN characters 4–7 to identify chassis/model. The app does **not** currently read vehicle order, SA/SALAPA options, or FRM coding to determine headlight equipment.
- `src/data/generated/modules/FRM3.ts` has separate `frontLeftIndicator`, `rearLeftIndicator`, right-side counterparts, and `highBeamLeft`/`highBeamRight`. It has no `indicatorLeftAll`, `indicatorRightAll`, `highBeamAll`, or exterior `hazard` element. It does have `hazardLed`, which is a distinct output. `KOMB01` supplies cluster feedback only.
- `data/ecu/FRM3.json` describes `FL_L`/`FL_R` as **halogen high beam / xenon cornering light**. It also names `BI_XENON_L_R`; the generated `FRM3.ts` exposes `BI_XENON_ON/OFF` as raw commands (`2F 01 0D 03 64/00`), not selectable elements. The effect of that command on this F11, any required low-beam state, and its safe restoration are unverified.
- `src/stores/presets.ts` seeds Double flash with only `highBeamAll` steps. `src/domain/runner/plan.ts` skips an absent target and throws `NothingToRunError` if nothing remains. Custom preset tiles in `src/ui/tile/items.ts` currently show available whenever connected, even when all their targets are absent; execution then fails.
- Generated `flash.indicatorLeft/Right` and `flash.highBeam` effects in `src/data/generated/effects.ts` require FEM_20/BDC aggregate elements. `src/domain/registry/helpers.ts` filters effects by `requiredModules` and the presence of every named element. Thus these effects cannot become available on FRM3 merely by adding a target expansion; the effect gate must use the resolved logical action.
- There is already a precedent: `src/domain/registry/rules.ts` and `targets.ts` resolve `brakeAll` to REM_20 left/right/center outputs. `src/domain/runner/plan.ts` executes target lists and records individual physical elements for cleanup. Extend this mechanism rather than translating UI labels directly into bytes.
- Candidate **indicator** composition for this F11: `indicatorLeftAll` → FRM3 `frontLeftIndicator` + `rearLeftIndicator` (right analogously). Whether both outputs light the expected lamps on this specific car has not been established. Do not map `highBeamAll` to FRM3 `FL_L/R` without identifying headlight equipment. Commands in a composition are sent serially, so a 100 ms flash may not be visually simultaneous, especially over a slow adapter.
- `data/ecu/README.md` documents other incomplete or ambiguous mappings. Never edit `src/data/generated/` directly; source changes go through `data/ecu/` and `scripts/gen-data.ts` when needed.

## What is known about BimmerLight

The public [BimmerLight site](https://bimmerlight.com/) says it detects a car and unlocks effects based on its light modules. Its [App Store listing](https://apps.apple.com/us/app/bimmerlight-for-bmw-mini-rr/id6745905907) describes per-vehicle pack optimization that removes commands the car rejects. **Neither source says how it distinguishes FRM3 halogen from xenon, or whether it does so at all.** The packaged/decrypted BimmerLight source must be inspected before making that claim.

BMW's [F10 complete vehicle training manual](https://bmwtechinfo.bmwgroup.com/tech_training_manual/ST1002%20F10%20Complete%20Vehicle.pdf) confirms that F10-family cars can have halogen or bi-xenon headlights and identifies option **522** as bi-xenon and **524** as adaptive headlights. These are useful equipment clues, but confirm the F11's actual configuration; retrofits/coding can differ from the factory order.

## Investigation on the computer with `PROTO/`

1. Locate the exact BimmerLight app/source version in `PROTO/`. Record artifact identity/version and whether the material is source, decompiled code, or data only. If it is a shipped IPA/APK, use the `reverse-engineer-anything` skill and preserve evidence references. Do not infer executable logic from mapping JSON alone.
2. Trace vehicle identification from connect through capability filtering: which requests obtain VIN, vehicle order/SA codes, headlight variant, FRM coding, or other ECU IDs? Search for `FRM3`, `FL_L`, `FL_R`, `BI_XENON`, `522`, `524`, `high beam`, `cornering`, `headlight type`, and any variant/option matching. Check whether it reads equipment at all or simply exposes available raw jobs.
3. Trace one BimmerLight logical high-beam action on FRM3 halogen and xenon paths (if both exist). Record the **selection condition**, exact command sequence, timing, and OFF/return-control sequence. Check whether bi-xenon needs the low beam plus shutter, whether the shutter is treated as one combined L/R control, and whether BimmerLight avoids rapidly cycling xenon lamps. Keep observations separate from inferences.
4. Trace left indicators similarly. Determine whether BimmerLight uses an FRM3 aggregate job, separate front/rear channels, a different module, or an adaptive fallback after ECU rejection. A positive UDS response alone does not prove that a physical lamp changed.
5. Compare the reference behavior with BimmerDisco's source data. Report what is confirmed, what is missing, and what requires an F11 hardware test. Avoid copying a presumed mapping into production until it has a safe, complete cleanup path.

## Implementation target after the evidence audit

- Define logical actions independently of ECU outputs. Resolve using detected modules **and equipment/variant facts**. Use a direct command when proven appropriate; otherwise use a validated composition; show unsupported/unknown when neither is justified.
- Make the same resolver drive Library availability, preset editor choices, seed/custom preset availability, and execution. Do not leave `requiredModules` as an extra rigid gate for actions already resolved by another module.
- Keep each resolved physical output in the control ledger and restore all outputs on completion, stop, error, disconnect, or background according to `docs/PLAN.md`.
- Add focused tests for FRM3 halogen and xenon, FEM_20+REM_20, BDC, unknown equipment, unavailable commands, and multi-output cleanup. Verify timing expectations rather than promising truly simultaneous outputs over a serial link.
- On the real F11, identify headlight type and test individual front/rear indicators and candidate headlight controls while recording request, reply/NRC, visible result, and cleanup. Only then label those actions as physically verified.

No resolver or ECU payload was changed during this conversation. Only documentation was updated. The milestone/log in `docs/PLAN.md` tracks this pending work.
