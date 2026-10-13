# BMW Light Control — Production App Plan & Progress

Single source of truth for decisions, architecture and progress. Every agent updates the **Progress** section when it finishes a task. Resume work by reading this file top to bottom.

- Reference material (local only, gitignored): `PROTO/` — prototype app (`PROTO/mobile_proto`), reverse-engineering output (`PROTO/analysis`), source ECU data (`data/ecu`)

## Decisions (grill session, 2026-10-13)

| #   | Topic              | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Why                                                                                                      |
| --- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 2   | UI kit             | **gluestack UI + NativeWind**, icons **phosphor-react-native**. Native only for behaviour: native-stack navigation, `formSheet` sheets, `Alert.alert` confirmations, haptics, keyboard. A project `CLAUDE.md` overrides the global `PlatformColor` / native-control rules.                                                                                                                                                                                                                                 | The design is a custom dark brand look (Geist, hand-picked palette, glow tiles), not iOS-native styling. |
| 3   | Data               | Use the BimmerDisco source data. Copy what we use into `data/BimmerDisco/` (tracked); a codegen script validates (zod) and emits typed modules to `src/data/generated/`. Module data is lazy-loaded per detected ECU.                                                                                                                                                                                                                                                                                   | One place; builds don't depend on `PROTO/`; small startup cost.                                          |
| 4   | Vehicle scope      | **F-series only** (UDS). Modules: FEM_20, REM_20, FRM3, BDC (F15 variant), FLE02_L/R, LHM2_L/R, KOMB01, KOMB25. G/E-series deferred; the protocol stack stays generic so G-series is mostly a data addition later.                                                                                                                                                                                                                                                                                         | That's what can be tested.                                                                               |
| 5   | Verification tiers | None — all F modules ship equally.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | User decision.                                                                                           |
| 6   | Architecture       | Four layers: `transport/` → `link/` → `protocol/` → `domain/`. Session = **XState v5** machine. UI/user state = **Zustand** persisted to `expo-sqlite/kv-store`. No React Query (no server). One serialised command queue with a priority lane for keepalive/stop.                                                                                                                                                                                                                                         | Forced-control state must be explicit; protocols lack transaction IDs.                                   |
| 7   | Safety & errors    | See **Safety policy** below. Missing error/empty/connecting states get designed in the canvas first.                                                                                                                                                                                                                                                                                                                                                                                                       | Worst bug = light left under forced control.                                                             |
| 8   | Functions          | Home as designed (Favourites / Predefined / My presets) + **Library** screen ("See all") with all packs (flash, headlight_flash, headlight_show, one_side, taillight_flash, taillight_show, party_mode, ghost, toggle), searchable, filtered to the detected car. Toggles are stateful tiles. Library actions can be favourited or duplicated into My presets. Step editor lists every element of the detected car. VIN read only to display the car. **Out of scope:** coding, fault read/clear, raw UDS. | "All functions" without overloading Home.                                                                |
| 9   | Motion             | Reanimated 4 (UI-thread), **@shopify/react-native-skia** for gradient border/glow/conic sweep, react-native-reorderable-list, gesture-handler, expo-haptics, Geist via expo-font. Honour Reduce Motion.                                                                                                                                                                                                                                                                                                    | The E4 look can't be drawn with plain Views.                                                             |
| 10  | Testing & security | Data-driven **simulator** (also powers in-app Demo mode). Jest (jest-expo) unit + byte-snapshot tests, XState model-based tests, integration tests per adapter, RNTL screen tests, **Maestro** E2E in Demo mode. Coverage ≥ 90 % on `protocol/`, `link/`, `domain/`. ESLint + Prettier + Husky + GitHub Actions. See **Security** below.                                                                                                                                                                   | Hardware can't cover every module.                                                                       |
| 11  | i18n               | i18next + react-i18next + expo-localization. **EN + PL**. Element names from our own keys. CI fails on missing keys.                                                                                                                                                                                                                                                                                                                                                                                       | Global convention: every string via `t()`.                                                               |
| 12  | Delivery           | Milestones M0–M9 below. Opus orchestrates & reviews; Sonnet implements (worktrees for parallel work); Haiku for mechanical tasks. Checkpoints with the user at M0, M5, M7; car test after M4.                                                                                                                                                                                                                                                                                                              |                                                                                                          |

## Adapters

All three speak UDS to F-series (D-CAN / Ethernet).

| Adapter    | Transport                       | Framing                                                                                                                                                                            | Notes                                                                                        |
| ---------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ENET       | TCP 6801 (USB-C Ethernet)       | HSFZ: `len(4 BE) 00 01 F4 <ecu> <UDS>`; answer alive-check 0x12 with 0x13; type 2 = ACK                                                                                            | Discovery: UDP broadcast `169.254.255.255:6811` (to implement; prototype used a manual IP).  |
| Thor       | TCP 23 over the adapter's Wi-Fi | BMW-FAST `80                                                                                                                                                                       | len, dest, src F1, payload, additive checksum`; echo filtering                               | Firmware behaviour unverified. |
| Vgate iCar | BLE ELM327                      | Init `ATZ ATE0 ATS0 ATL0 ATH1 ATAL ATCAF0 ATPBE101 ATSPB ATBI ATAT2 ATFCSH6F1 ATSH6F1`; per-ECU `ATFCSD<ecu>30FF08 ATFCSM1 ATCRA6<ecu> ATCEA<ecu>`; ISO-TP SF/FF/CF + flow control | Write char `BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F`; slower round-trip — warn on fast presets. |
| Demo       | in-process simulator            | —                                                                                                                                                                                  | Any F chassis, fault injection.                                                              |

Design change: the Cable screen lists **ENET / Thor / Vgate iCar / Demo** (K+DCAN removed).

## Architecture

```
app/                      expo-router routes (thin; compose feature components)
src/
  transport/              TcpTransport (ENET, Thor), BleTransport (iCar)       raw bytes
  link/                   HsfzLink, ThorLink, ElmIsoTpLink, SimLink → DiagnosticLink.request(ecu, payload)
  protocol/               UDS codec, NRC decoding, 0x78 pending, keepalive scheduler, command queue
  domain/                 session machine (XState), ModuleRegistry, PresetRunner, effects
  simulator/              SimulatedVehicle (data-driven, fault injection)
  data/generated/         codegen output (do not edit)
  stores/                 Zustand stores (favourites, presets, settings)
  ui/                     gluestack theme, shared components (Tile, TileBackground, Section…)
  features/               screen-level components per feature
  i18n/                   en.json, pl.json
data/BimmerDisco/         source F-series source data (tracked)
scripts/gen-data.ts       codegen
e2e/                      Maestro flows
```

Session machine: `idle → connecting → identifying → ready ⇄ running → restoring → disconnected | error` (plus `reconnecting`).

## Safety policy

1. Forced control is always undone: off for every touched element → return-control → `10 01`. Runs on stop, completion, error, disconnect, and app backgrounding.
2. App going to background stops and restores immediately (iOS suspends sockets/BLE).
3. Identification fails closed: no known F module answering `22 F1 50` → presets locked with explanation.
4. Limits: 90 s per run, 50 ms minimum step; command rate throttled to the adapter's measured RTT.
5. Error UX tiers: inline tile error (shake + red edge + reason, e.g. NRC 0x22 "stop the car / ignition on") → toast (transient) → full-screen state (adapter unreachable, Bluetooth off/denied, car not responding, connection lost while running).
6. Auto-reconnect: 3 attempts with backoff; if anything was under forced control, restore immediately after reconnect.

## Security

- Preset import: zod strict schema, size limits, unknown keys rejected, elements must exist.
- ENET/Thor host limited to private and link-local IPv4 ranges.
- No raw wire logs in release builds; debug log behind a hidden developer toggle.
- No analytics, no network calls; App Privacy "no data collected".
- BLE connects only to devices exposing known adapter service UUIDs.
- Pinned dependencies, `npm audit` in CI.

## Known protocol uncertainties

- Nothing has been verified on a real car or adapter (except vendor claim for `2E D5 42 00 05 00 64`).
- FRM3 identity bytes `62 F1 50 0F 10 D0` medium confidence; FRM3 has no return-control (rely on per-light off + `10 01`; `2F 01 <ch> 00` unverified).
- Whether `2F 45 01 00 FE` cancels `2E D5 42` aggregate writes; meaning of the D542 time field.
- `ATFCSD` argument order (medium confidence); Thor adapter init/firmware behaviour.
- Keepalive `3E FF` vs `3E 80` semantics and cadence; whether the KOMBI routine `31 01 F0 12 01 FC 21` is required.
- IO-control response matcher should check channel, not only DID (prototype weakness).

## Milestones & progress

Status: ☐ todo · ◐ in progress · ☑ done

| #   | Milestone                                                                                                                                | Status |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| M0  | Ignore `PROTO/`, scaffold Expo at root, tooling (ESLint, Prettier, Jest, Husky, CI), project `CLAUDE.md` overrides, this plan            | ☑      |
| M1  | Data pipeline: F-series data → `data/BimmerDisco/`, zod schemas, codegen, byte-snapshot tests                                            | ☐      |
| M2  | Protocol + links: UDS codec, HSFZ/ENET (+UDP discovery), Thor, ELM/ISO-TP, command queue, keepalive                                      | ☐      |
| M3  | Simulator + Demo link with fault injection                                                                                               | ☐      |
| M4  | Domain: XState session, ModuleRegistry, PresetRunner, model-based tests → **user car test**                                              | ☐      |
| M5  | Design canvas: connecting, error, empty states, Library, Cable list → **user checkpoint**                                                | ☐      |
| M6  | UI foundation: gluestack + NativeWind theme from E4 tokens, Geist, Phosphor, i18n EN/PL, navigation skeleton                             | ☐      |
| M7  | Screens: Connect, Settings, Cable, Home, Library, tile menu, favourites edit, preset editor, add step, icon picker → **user checkpoint** | ☐      |
| M8  | Motion: Skia tiles, sweep, wiggle, reorder, haptics, reduced motion                                                                      | ☐      |
| M9  | Hardening: Maestro E2E, coverage gate, security review, code review, performance pass                                                    | ☐      |

### Log

- 2026-10-13 — Grill session complete; plan written. M0 started.
- 2026-10-13 — M0 done: Expo SDK 57 (expo 57.0.28, RN 0.86.3, React 19.2.3, expo-router 57.0.26, TypeScript 6.0.3) scaffolded at repo root with `app/` routes and `src/` skeleton; ESLint 9 + eslint-config-expo + react-hooks + import/order, Prettier 3, jest-expo 57 (Jest 29) with per-dir 90% coverage thresholds activated once `src/protocol|link|domain` contain sources, Husky 9 + lint-staged, GitHub Actions CI, project `CLAUDE.md`. `expo-doctor` 21/21.

## How to resume

1. Read this file; find the first ◐/☐ milestone.
2. Check `git log --oneline -20` for the last completed task.
3. Reference prototype code in `PROTO/mobile_proto/src` (codecs/links are worth porting) and protocol evidence in `PROTO/analysis/*.md`.
4. After finishing a task: update the milestone row + add a Log line, run typecheck/lint/tests, commit (include this file).
