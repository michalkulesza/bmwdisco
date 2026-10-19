# Logical light actions: implementation plan

Date: 2026-10-17. Status: software foundation implemented on 2026-10-17; hardware mapping gates remain pending. See PLAN.md for validation results and logical-actions-inventory.md for the current 140-effect source inventory (the original planning estimate below was 139). No ECU payload or generated module was changed.

This plan follows the safety policy in [PLAN.md](PLAN.md) and records the implementation contracts, rollout sequence, and validation gates for logical lighting actions.

## 1. Scope and decisions

1. Presets express visible intent through a new `action` step. Retain existing `set` steps as an explicit compatibility format. Never rename FRM3 `highBeamLeft` into cornering in a saved preset.
2. A pure domain resolver supplies physical targets to both availability and execution. Resolution is not an ECU probe and never sends a command.
3. Equipment selection starts with explicit vehicle-specific user input and recorded physical confirmation. FA/SALAPA acquisition is deferred: its decoder, retrofit handling, and read behavior are not established here. Keep provenance types ready for that later addition.
4. Equipment knowledge and command validation are independent. Selecting “halogen” does not validate FL_L/R. A positive diagnostic reply does not validate a lamp.
5. Initial delivery fixes availability consistency and adds the architecture. It enables no new FRM3 compositions or headlight commands on hardware. FRM3 indicator compositions can be enabled after their own visible test gate; headlight mappings have a separate gate.
6. Preserve existing F32 brake substitution and explicit legacy LED warnings. Do not broaden their physical validation claims to BDC or all F-series vehicles.
7. Do not add arbitrary raw commands to normal presets in this delivery. The xenon shutter remains a guarded diagnostic candidate until its preconditions, visible behavior, and undo are established.

## 2. Source audit and current constraints

| Concern            | Repository evidence                                                                                 | Consequence                                                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Detection          | `src/domain/registry/detect-car.ts:48-115`; `registry/types.ts:17-27`                               | VIN and ECU identities exist; equipment does not. Availability is currently built during detection.                                                                                  |
| Physical expansion | `registry/targets.ts:11-32`; `registry/rules.ts:16-39`                                              | Existing `brakeAll` substitution is the precedent. Headlight rules currently feed warning behavior; they must not be mistaken for a complete equipment resolver.                     |
| Effect gate        | `registry/helpers.ts:78-94`                                                                         | `requiredModules` blocks otherwise resolvable actions. `ghost.fullOFF` intentionally permits partial coverage.                                                                       |
| Runner             | `runner/plan.ts:70-128`                                                                             | Missing elements are skipped, sends deduplicated by module/element, and only an entirely empty run fails. Mixed presets can silently lose intended behavior.                         |
| Ledger             | `runner/runner.ts:254-274`; `runner/ledger.ts`; `runner/cleanup.ts:53-144`                          | Ledger is armed before a request; only a newly touched output rejected by NRC is removed. Timeout must remain armed because the ECU may have acted. Raw undo support already exists. |
| Presets            | `preset/types.ts`; `preset/schema.ts:15-68`; `stores/presets.ts`                                    | Store version 2; legacy loop preprocessing; strict element schema. Seed Double flash uses `highBeamAll`.                                                                             |
| Transfer           | `preset/limits.ts`; `preset/import-export.ts:19-57`                                                 | File version 1 is separate from store version. Strict keys, limits, duplicate IDs and size checks must survive migration.                                                            |
| UI                 | `src/ui/tile/items.ts:22-39`; `features/preset/LightPicker/index.tsx`; `AddStepSheet/index.tsx`     | Connected custom presets are always marked available; picker and effects use different lists.                                                                                        |
| Generation         | `scripts/gen-data/effects.ts:68-220`; `scripts/gen-data/build.ts:73-112`; `src/data/types.ts:30-48` | Effect commands become element IDs and module requirements. Keep generated data immutable; add semantic metadata above it for this delivery.                                         |
| Diagnostics        | `src/domain/raw/test-bench.ts`, `test-session.ts`; `features/settings/TestCommandsScreen/`          | Reuse the guarded test path for evidence collection. Normal actions must never probe unknown hardware.                                                                               |

The FRM3 source descriptions are in `data/ecu/FRM3.json:124-154` (FL_L/R ambiguity and combined shutter), and `:303-347` (front/rear indicators). Generated `src/data/generated/modules/FRM3.ts:57-67,132-150,198-204` provides current command candidates and shows no generic return-control payload. These references establish static data, not physical operation.

## 3. Domain contracts

Add `src/domain/actions/{types,catalog,mappings,resolver,availability,legacy,effect-actions}.ts` and export their public interfaces through `src/domain/index.ts`. Keep physical `ElementId` separate from branded/union `LogicalActionId` even where the text resembles an existing ID.

Initial semantic catalog: `indicatorsLeft`, `indicatorsRight`, `bothHighBeams`, `highBeamLeft`, `highBeamRight`, `lowBeamLeft`, `lowBeamRight`, `bothLowBeams`, `corneringLeft`, `corneringRight`, `brakesAll`. Catalog `biXenonShutterBoth` as a distinct intent but leave it unavailable for normal runs until the later shutter gate. Remaining existing controls stay explicit legacy entries initially; converting all 87 IDs is a follow-up inventory task, not an implicit name-based conversion.

```ts
type ResolutionContext = {
  car: DetectedCar;
  facts: VehicleFacts;
  validations: readonly MappingValidation[];
  revision: number;
};

type ActionResolution =
  | { status: 'supported'; mappingId: string; targets: readonly ElementTarget[];
      evidence: 'existingCompatibility' | 'hardwareVerified' | 'simulation';
      warnings: readonly ActionWarning[] }
  | { status: 'unknown'; reason: 'equipmentUnknown' | 'equipmentConflict'
      | 'confirmationRequired'; candidateMappingIds: readonly string[] }
  | { status: 'unsupported'; reason: 'missingModule' | 'missingOutput'
      | 'noSemanticMapping' | 'commandRejected' };

resolveAction(context, actionId): ActionResolution;
resolveLegacyElement(context, elementId): ActionResolution;
assessRunnable(context, item): RunnableAssessment;
```

`ElementTarget` continues to identify a detected module and physical element with existing ON/OFF payloads. Mapping metadata includes deterministic order, required equipment, validation scope, warning flags, and cleanup requirements. A candidate lives in the mapping catalog but cannot appear as `supported` merely with `evidence: candidate`.

`RunnableAssessment` contains `status: runnable | partial | needsConfirmation | unsupported`, per-step/per-intent resolutions, missing reasons, warnings, and a resolved execution input bound to `revision`. A wait alone is never runnable. Normal presets/effects require every action in every step to resolve, including toggle OFF paths. A composed action is atomic at resolution: missing one target makes the whole action unavailable.

Keep the existing `ghost.fullOFF` behavior as the sole explicit `allowPartial` effect policy, attached in effect metadata. Its assessment lists omitted intents and is runnable only with at least one supported output. Do not introduce silent partial custom-preset playback. Mixed old presets remain editable/exportable and show why Run is blocked.

### Resolution precedence

1. Reject unknown/conflicting equipment where the mapping depends on it; presence of FRM3 is never equipment evidence.
2. Remove incomplete, incompatible, rejected, or unvalidated candidates according to their scope. A rejection is scoped to vehicle/module identity/mapping version, not every car with that SGBD.
3. Use an explicit ordered mapping rule for this action and configuration. Prefer an approved direct aggregate only when its semantics/validation apply; otherwise choose an approved complete composition.
4. Select exactly one mapping. Never concatenate every module sharing an element name. If multiple providers have no documented precedence, return `unknown/confirmationRequired`.
5. Deduplicate physical targets by ECU address + SGBD + physical element while preserving declared order. Keep per-step state ordering; never deduplicate across time steps.

The legacy adapter explicitly bridges precise aggregate IDs (`indicatorLeftAll`, `indicatorRightAll`, `highBeamAll`, `lowBeamAll`, `brakeAll`) to semantic intents. It must not bridge by string similarity. FRM3 legacy `highBeamLeft/Right` gets an equipment/confirmation gate; xenon must not execute FL_L/R under a high-beam label. Unknown unsafe legacy steps remain stored with an explanation. Existing LED no-light warnings stay available on explicit legacy controls as previously requested; new semantic headlight actions must not inherit those known ineffective routes.

## 4. Equipment and validation lifecycle

Add `src/domain/vehicle/{types,facts}.ts`, `src/stores/vehicle-facts.ts`, and a Settings equipment section/screen with EN/PL strings. `VehicleFacts` stores headlight type (`halogen | xenon | led | unknown`) plus source (`userSelection | factoryOrder | inferred | physicalConfirmation`), timestamp, and vehicle binding. Preserve source assertions rather than overwriting conflicts with the latest value.

- Use a valid VIN as the local persistence key; do not export it with presets, diagnostics, or feedback. Existing scrubbing rules apply to new diagnostic metadata.
- Missing VIN: facts and confirmations are session-only; chassis/module similarity cannot restore another vehicle's facts.
- Changed VIN: use that VIN's facts or unknown. Same VIN with changed module identity/equipment invalidates affected confirmations. Retrofits require explicit conflict resolution and retest.
- Distinguish selecting equipment from confirming an individual mapping. `MappingValidation` binds vehicle identity, relevant ECU identity, mapping ID/version, equipment revision, observed outputs, and verified release. No positive reply can create it automatically.
- Factory-order inference, when added later, cannot override observed retrofit/user-confirmed equipment silently. Conflicting assertions make dependent actions unknown until resolved.
- Demo has isolated fixture facts/validations labeled `simulation`; never persist them into a real VIN profile.

Add a pure `deriveCapabilities(car, facts, validations)` helper. Session identification and UI selectors use it instead of independently filtering. Update `registry/types.ts`, `detect-car.ts`, domain session `types.ts`, `actors.ts`, `machine.ts`, `helpers.ts`, and `src/session/SessionProvider.tsx` / `hooks.ts`. Derive existing `car.effects`/selectable compatibility fields from the same assessment while callers migrate; remove duplicate filtering once migrated.

Facts can change only while ready with no pending cleanup. Recompute capabilities immediately without reconnect, increment context revision, and invalidate cached assessments. During a run, freeze resolved targets/facts/revision. Equipment changes never rewrite the active ledger or cleanup plan. The final session run gate reassesses against the current revision before the first actuation.

On reconnect, restore from the original physical ledger, never by resolving the logical action again. Preserve retry bounds and re-enter extended sessions as required. Verify vehicle/module identity before sending old cleanup to a newly identified vehicle; mismatch blocks new runs and retains the unresolved cleanup warning. Missing/changed identity is not grounds to clear the ledger or to guess a new cleanup target.

## 5. Mapping and confidence table

“Existing compatibility” preserves shipped behavior; it does not claim a visible hardware test. New FRM3 candidates require explicit validation. Every rule gets a stable mapping ID/version and evidence reference in `mappings.ts`.

| Configuration / intent                      | Physical route and precedence                                                      | Evidence / initial delivery                                                                                                                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FRM3 left/right indicators                  | Front + rear output on the same FRM3, ordered front then rear; both required       | Static candidate: FRM3 JSON indicator rows and generated channels. Return unknown until visible front/rear and cleanup confirmation. Do not call this all side lamps if repeaters were not verified; label/help must state the verified coverage. |
| FRM3 unknown equipment / high beams         | None                                                                               | Unknown equipment; never FL_L/R fallback.                                                                                                                                                                                                         |
| FRM3 halogen / left, right, both high beams | FL_L, FL_R, or ordered L+R                                                         | Static candidate: FRM3 JSON FL descriptions. Equipment plus visible lamp/release validation required; disabled initially.                                                                                                                         |
| FRM3 xenon / high beams                     | No left/right route established; both-shutter route is not yet a high-beam mapping | Combined `BI_XENON_L_R` exists, but low-beam prerequisites, timing and release are unknown. No automatic shutter or FL fallback.                                                                                                                  |
| FRM3 xenon / cornering left/right           | FL_L/R candidates                                                                  | Different semantic action from high beam. Requires visible confirmation and release; disabled initially.                                                                                                                                          |
| FRM3 / shutter both                         | Raw ON/OFF channel 0D candidate                                                    | Guarded diagnostics only. Promote via tracked source/codegen to an element with explicit OFF only after the separate shutter gate. No unilateral shutter semantics.                                                                               |
| FEM_20 / aggregate indicators, high beams   | Existing corresponding aggregate only within explicit compatibility rule           | Generated FEM_20 aggregate definitions; existing behavior, not universally validated. Prior indicator reports include no light/disconnection; do not present them as proven. No automatic fallback after NRC.                                     |
| BDC / aggregate indicators, high beams      | BDC aggregate via explicit rule; FEM+BDC together requires precedence evidence     | Generated BDC aggregate definitions; static/existing compatibility. No claim of BDC car validation.                                                                                                                                               |
| FEM_20 + REM_20 / brakes all                | REM brakeLeft + brakeRight + brakeCenter, replacing aggregate                      | Existing `rules.ts` substitution; F32 observed left/right, center is current composition data, not separately proven in the log. Preserve behavior and document evidence granularity.                                                             |
| FLE02 present / semantic low/high beams     | No automatic use of FEM/BDC per-side outputs or generic FLE routines               | F32 test demonstrated positive replies without lamps for FEM per-side outputs. Keep explicit legacy warning behavior; semantic alternatives need their own proof.                                                                                 |
| Missing output or ambiguous providers       | None                                                                               | Unsupported missing output, or unknown provider choice. Never execute an incomplete composition.                                                                                                                                                  |
| KOMB01 / exterior lamps                     | None                                                                               | Cluster feedback only; optional feedback failure must not supply or validate an exterior action.                                                                                                                                                  |

For source traceability use `data/ecu/FRM3.json`, `src/data/generated/modules/{FRM3,FEM_20,REM_20,BDC,FLE02_L,FLE02_R}.ts`, `registry/rules.ts`, and the car-test Log in PLAN.md. ECU descriptions and generated command candidates do not establish a validated physical composition or automatic equipment selector.

## 6. Preset schema and effect compatibility

Add this step without replacing legacy `set`:

```ts
interface ActionStep {
  type: 'action';
  actions: LogicalActionId[];
  state: 'on' | 'off';
  durationMs?: number;
}
// PresetStep = SetStep | ActionStep | WaitStep
```

Update `preset/{types,schema,limits,import-export,effect-preset}.ts`, editor draft/form helpers, and duration/step discriminant consumers. Apply the existing 64-intent limit to either set/actions arrays, 200 steps, 50 ms minimum timed steps, 90 s cycle limit, size limit and strict keys. Keep mutually exclusive step shapes; reject unknown action IDs and arbitrary payload fields.

- Bump Zustand presets version **2 → 3**. Migration retains all legacy set steps and applies the existing trailing-loop normalization; it does not rewrite user content or seed IDs. Validate each migrated record through the existing strict merge path. Keep existing invalid-record handling; do not discard a structurally valid preset because this car cannot resolve it.
- Bump export format version **1 → 2**. Import v1 through its original strict set/wait validator and legacy loop normalization, then normalize into the supported in-memory union. Import v2 using the new strict union. Reject unknown versions; export only v2. Compatibility does not depend on the current car being connected.
- New installations seed Double flash with `bothHighBeams` action steps; existing persisted seeds remain unchanged. The explicit aggregate legacy adapter provides consistent resolution without overwriting edited seeds. Seed user-facing names must use the existing translation pattern or add a name-key mechanism; do not persist translated names over user edits.
- Import/export round trips preserve playback, timings, names, IDs, and old per-output steps. Retain favourite IDs and duplicate/collision behavior.

Migrated/imported `set` steps remain `set` and always enter `resolveLegacyElement`; newly authored semantic selections create `action` steps. The compatibility bridge is an explicit routing policy, not a persisted rewrite. In the initial release legacy FRM3 `highBeamLeft/Right` remains blocked pending equipment and mapping validation, while legacy `highBeamAll` retains only existing supported routes. New FRM3 aggregate routes require the hardware gate regardless of the step format. Test fresh-store semantic seeds separately from persisted v2 original and edited seeds; the persistence merge must preserve those entries exactly.

For built-in effects, add an explicit domain `effect-actions.ts` adapter/manifest keyed by effect ID and source element. Map only audited intents. Remaining steps use `resolveLegacyElement`. Do not edit `src/data/generated/` or claim every effect has semantic metadata. Add a completeness/staleness check: overrides must reference actual generated effect IDs/steps, and semantic effects cannot also retain independent rigid module gating.

For migrated semantic effects, availability requires all resolved action steps and execution prerequisites, not `requiredModules`. Keep required-module checks only for remaining explicitly legacy effects until their prerequisites are audited. Verify cluster feedback remains best effort and silence/undo requirements follow selected physical targets, including toggle OFF. Duplicate-to-preset conversion must use the same adapted steps as direct playback. A later generation refactor may move semantic annotations into tracked pack source; it is unnecessary for this first delivery.

## 7. Execution and safety integration

Update `runner/plan.ts` to consume the assessed resolved steps and produce the existing physical `PlannedSend` structure. Add context revision checking at the session run boundary. Preflight failures issue no session/actuation commands. The plan and UI must report the same missing actions; retain skipped reporting only for explicitly partial effects.

Keep runner serialization, RTT measurement, keepalive priority, drift correction, Hold/Loop semantics and stop behavior. A multi-output step sends sequentially; measure its full cost and exercise the existing `tooFast` warning with compositions. Do not promise a simultaneous 100 ms double flash. No new xenon timing is approved by this plan.

Preserve ledger semantics precisely:

1. Arm the physical output immediately before its request.
2. Positive response keeps it armed; positive response still says nothing about visible success.
3. Definitive NRC on first activation removes only that newly touched output. A previously touched output remains armed even when a later OFF is rejected.
4. Timeout, disconnect, or cancellation after send keeps the uncertain output armed.
5. If front succeeded and rear failed, stop the run and restore the successful/uncertain outputs. Do not start the next effect step or try another mapping.
6. Cleanup remains per-output OFF → module return-control where defined → communication-on `28 00 03` if silenced → default session `10 01`, best effort on priority lane. FRM3 has no validated generic return-control: its actual OFF + session restore must be tested.
7. Failed cleanup retains pending state and warning; reconnect restoration uses the retained original targets. No capability recalculation can erase a cleanup obligation.

Reuse existing raw diagnostic undo tracking for guarded shutter experiments. If a future normal shutter action needs prerequisites, introduce a typed plan with prerequisite and inverse operations and prove ledger behavior before enabling it. Never hide raw commands in a synthetic logical ID without OFF/restore ownership.

## 8. File-by-file delivery sequence and ownership

The orchestrator owns contracts, review and integration. Use Luna for bounded implementation batches and mechanical inventory. Each batch includes tests and a PLAN.md milestone/Log update. Parallel batches start only after their shared types are committed or otherwise frozen; avoid concurrent edits to session/types, domain exports, locale files and PLAN.md.

| Batch / owner                                                      | Files and concrete changes                                                                                                                                                                            | Completion gate / dependency                                                                                               |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A: inventory, Luna; review orchestrator                            | Add checked inventory to this document or a companion: all aggregate IDs, their providers, 139 effect adapters/prerequisites, all `PresetStep` consumers. Confirm code references with `rg`.          | No runtime changes; every special-case effect and legacy warning policy recorded.                                          |
| B: contracts/resolver, Luna; orchestrator approves                 | New `actions/*`, `vehicle/*`; registry types/helpers/targets/rules; domain exports. Pure resolver, legacy adapter, evidence metadata, explicit provider selection, assessment.                        | Table-driven tests pass; unknown FRM3 cannot emit targets. Depends A.                                                      |
| C: schema, Luna                                                    | `preset/*`, `stores/presets.ts` and tests; add action steps, store v3, file v2/v1 import, seed and effect conversion.                                                                                 | Old fixtures round-trip unchanged, new strict union validated. Depends B contracts.                                        |
| D: facts/session, Luna                                             | New vehicle facts store and tests; registry detection/deriveCapabilities; session actors/types/machine and hooks. Ready-only fact changes, revisions, frozen runs, reconnect identity handling.       | Changed/missing VIN and pending cleanup tests pass. Depends B; integrate before UI.                                        |
| E: execution/safety, Luna; orchestrator reviews every cleanup diff | Runner plan/types/runner only where required; ledger/cleanup changes only if justified; effect metadata adapter.                                                                                      | Consistency, partial-failure and all termination-path tests pass. Depends B/C/D.                                           |
| F: UI/i18n, Luna                                                   | `ui/tile/items.ts`, Home/Library/favourites consumers, `features/preset/LightPicker`, AddStepSheet, StepRow/editor/draft/transfer; Settings equipment UI, `app/` thin route if needed; EN/PL locales. | Same assessment drives tile, picker, editor Test and session Run. Unknown explains next step. Depends C/D/E public APIs.   |
| G: simulator/E2E, Luna                                             | Simulator fixtures/dead-output policy as needed; registry/runner/session/store/RNTL tests; new Maestro flow plus script wiring.                                                                       | Deterministic FRM3 unknown/halogen/xenon and F32/BDC cases; no simulator claim promoted to hardware evidence. Depends B-F. |
| H: integration/release, orchestrator                               | Review generated-file immutability, privacy, schema compatibility, coverage, and all evidence labels; update PLAN.md.                                                                                 | Software gate below. Hardware mapping enablement remains separate.                                                         |

For first implementation, run B → C → D → E → F → G sequentially if only one Luna worker is available. With multiple workers C and D may proceed together after B types freeze; the orchestrator resolves integration before E. No user confirmation is needed to implement these reversible code batches. Physical tests require access to the actual vehicle.

## 9. Verification matrix

Extend existing suites rather than replacing established runner/session tests. Suggested new suites: `src/domain/__tests__/logical-actions.test.ts`, `action-availability.test.ts`, and `src/stores/vehicle-facts.test.ts`.

Concrete UI/session regression targets: `src/features/preset/PresetEditorScreen/PresetEditorScreen.test.tsx`, `src/features/library/LibraryScreen/LibraryScreen.test.tsx`, `src/features/home/HomeScreen/HomeScreen.test.tsx`, `src/features/favourites/EditFavouritesScreen/EditFavouritesScreen.test.tsx`, `src/session/__tests__/session-provider.test.tsx`, and `src/domain/__tests__/session.test.ts` for the final RUN gate.

| Scenario                          | Required assertions                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FRM3 unknown                      | Indicator candidates require confirmation; high-beam actions require equipment; zero actuation on blocked Run.                                                           |
| FRM3 halogen                      | Selection alone insufficient; scoped validated L/R maps each correctly; both action requires both outputs.                                                               |
| FRM3 xenon                        | No FL high-beam fallback; no left-only inference from combined shutter; cornering separate. Shutter disabled in normal presets.                                          |
| FEM+REM / BDC / FLE               | Brake substitution preserved; no accidental multi-provider broadcast; FLE semantic headlights do not route to known dead outputs; legacy warnings preserved.             |
| Missing output / rejected mapping | Composition resolves all or none; reason is distinct from equipment unknown; no fallback actuation after NRC.                                                            |
| UI consistency                    | Library, Home seed/custom/favourites, editor picker, editor Test and direct RUN agree on status and reasons for the same context. Explicit ghost partial policy covered. |
| Multi-output failures             | First NRC, second NRC after first success, OFF NRC after prior ON, timeout after send, stop between sends; exact retained ledger and cleanup bytes/order.                |
| Session termination               | Completion, Stop, background, error, disconnect, reconnect success/failure; bounded retries and pending cleanup preserved. Changed VIN/ECU cannot redirect old cleanup.  |
| Facts lifecycle                   | VIN reuse, changed/missing VIN, retrofit conflict, changed mapping version; immediate ready-state recomputation; active/pending-restore edits blocked.                   |
| Persistence                       | Store versions 1/2 → 3; loop preprocessing; edited seed retained; v1 import, v2 round-trip, duplicate IDs, invalid keys/action IDs, limits and oversize files.           |
| Timing and playback               | Serial target order, measured slow adapter, tooFast once, no arbitrary timing compression, Hold/Loop stop and 90 s cycle limit retained.                                 |
| Demo                              | Facts isolated from hardware; deterministic scenarios; simulator can still return positive replies for known dead outputs without treating them as valid semantics.      |

Run focused Jest suites per batch, then `pnpm typecheck`, `pnpm lint`, `pnpm test -- --runInBand` (or the repository's accepted equivalent), `pnpm test:coverage`, and `pnpm gen:data:check`. Require at least 90% coverage in protocol/link/domain and preserve the current simulator gate. If no data source/generator changed, generation check still verifies no accidental drift; never hand-format generated modules.

Add `e2e/logical-actions.yaml`: Demo connect → inspect seed availability → editor action selection → supported run → Stop → incompatible preset explanation. Cover unknown equipment with a deterministic Demo fixture and equipment selection/reassessment. Wire into the existing Maestro script. Run on a configured iOS simulator; Android/native validation is recorded separately if unavailable. Do not claim Maestro or hardware checks passed when only Jest ran.

## 10. F11 worksheet and mapping release gates

Create `docs/f11-logical-actions-validation.md` when actual observations are available; do not fill successful outcomes in advance. Record privately retained VIN binding or a masked vehicle reference, chassis, FRM3 identity bytes, KOMB identity, actual lamp equipment/retrofits, adapter and measured RTT, mapping version, date, operator observation, ignition/engine state and relevant prerequisites. Public/shared diagnostics must continue omitting VIN/host details.

For each test capture: intent, physical output, exact request bytes, response/NRC, visibly affected lamp(s), activation duration, explicit OFF request/result, session/return-control result, observed final lamp state, and cleanup report. Existing diagnostic logs capture protocol traffic; the worksheet adds the human observation they cannot supply.

Test order:

1. Use the existing guarded Test commands flow and verify restore/Stop before further tests. Identify whether the car is halogen/xenon/other from actual equipment; ECU identity alone is insufficient.
2. Test individual FRM3 front-left, rear-left, front-right and rear-right indicators one at a time with bounded duration. Confirm which exterior lamps/repeaters respond and that each releases. Test serial left and right compositions only after their components succeed.
3. Check Stop, app backgrounding and recoverable connection loss restoration of the approved indicator composition. If cleanup fails, suspend further activation and retain the unresolved warning.
4. Only after identifying equipment, test the relevant FL_L/R candidates at a deliberate bounded duration. Record whether the visible result is high beam or cornering, then OFF/default-session behavior. Do not use Double flash's 100 ms cycle as the discovery test.
5. Xenon shutter testing is a separate gate: establish whether low beam must already be active, how that prerequisite is controlled, shutter release, and whether cleanup preserves/restores the original low-beam state. Until established, no normal shutter/high-beam action is enabled. Do not cycle xenon bulbs rapidly to discover behavior.

Release gates:

- **Software foundation:** unified assessment, strict schema compatibility, UI explanations, facts lifecycle and safety tests pass; no new FRM3 output enabled. Existing independent supported controls continue working. Double flash on this F11 may correctly remain unavailable with an equipment/validation explanation.
- **FRM3 indicators:** visible front/rear coverage and OFF/session restoration documented for this vehicle; failure-path tests pass; mapping validation scope recorded. This does not validate every FRM3 vehicle or include untested repeaters.
- **FRM3 halogen high beam:** equipment and visible FL behavior, serial timing and cleanup verified for the scoped configuration. Only then may Double flash use the composition, with measured timing warnings.
- **FRM3 xenon/shutter:** separate validated prerequisite/undo design and visible tests. No release based solely on factory equipment data or an ECU acknowledgement.

Information needed from the user at the hardware stage: actual F11 headlight equipment/retrofits, which indicator control originally failed, and observed lamp/cleanup results from the worksheet. None of these blocks implementing the software foundation.
