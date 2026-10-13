# BimmerDisco — Production App Plan & Progress

Single source of truth for decisions, architecture and progress. Every agent updates the **Progress** section when it finishes a task. Resume work by reading this file top to bottom.

- Reference material (local only, gitignored): `PROTO/` — prototype app (`PROTO/mobile_proto`), reverse-engineering output (`PROTO/analysis`), source ECU data (`data/ecu`)

## Decisions (grill session, 2026-10-13)

| #   | Topic              | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Why                                                                                                      |
| --- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 2   | UI kit             | **gluestack UI + NativeWind**, icons **phosphor-react-native**. Native only for behaviour: native-stack navigation, `formSheet` sheets, `Alert.alert` confirmations, haptics, keyboard. A project `CLAUDE.md` overrides the global `PlatformColor` / native-control rules.                                                                                                                                                                                                                                 | The design is a custom dark brand look (Geist, hand-picked palette, glow tiles), not iOS-native styling. |
| 3   | Data               | Use the source ECU data from `data/ecu`. Copy what we use into `data/ecu/` (tracked); a codegen script validates (zod) and emits typed modules to `src/data/generated/`. Module data is lazy-loaded per detected ECU.                                                                                                                                                                                                                                                                   | One place; builds don't depend on `PROTO/`; small startup cost.                                          |
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
data/ecu/         source F-series source data (tracked)
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
- Pinned dependencies, `npm audit --omit=dev --audit-level=critical` in CI (remaining highs are transitive in the Expo build toolchain, not shipped code).

## Known protocol uncertainties

- Nothing has been verified on a real car or adapter (except vendor claim for `2E D5 42 00 05 00 64`).
- FRM3 identity bytes `62 F1 50 0F 10 D0` medium confidence; FRM3 has no return-control (rely on per-light off + `10 01`; `2F 01 <ch> 00` unverified).
- Whether `2F 45 01 00 FE` cancels `2E D5 42` aggregate writes; meaning of the D542 time field.
- `ATFCSD` argument order (medium confidence); Thor adapter init/firmware behaviour.
- Keepalive `3E FF` vs `3E 80` semantics and cadence; whether the KOMBI routine `31 01 F0 12 01 FC 21` is required.
- IO-control response matcher should check channel, not only DID (prototype weakness); generated `expectedResponsePrefix` covers service and DID only because the data does not say whether the channel is echoed.
- LHM2_L/R: the channel routine writes a 14-field record but each mapping row names one field, so no LHM2 element is generated (FLE02 covers F20 headlights). FRM3 `SL_I_L` has an empty channel list (`tailInnerLeft` not generated); FRM3 `BL_L_2/R_2` and `ABBL_L/R` have no channels (not generated).
- Pack actions contain no timing: steps are ordered ticks and the runner picks the interval. Toggle ON/OFF actions are merged into one effect with `offSteps`.
- FLE02 `STOP_ROUTINE` (`31 02 A5 43`) is kept as a command only; unverified that it stops every LED routine, so it is not treated as return control. COMMUNICATION_OFF (`28 02 01`) is required by headlight LED effects (`silenceCommunication`) and must be restored with `28 00 03`.
- F32 has no row in the identification table (FEM_20 `0F16B0` is listed under F20), so chassis-to-module hints are sparse; identification relies on `22 F1 50`.
- F10 `positionLeft`/`positionRight` alias `daytimeLeft`/`daytimeRight` (same channels); F10 has no `ambient`, only `ambient1`/`ambient2`.
- IO-control response matcher: for FEM-style `2F 45 01 03 <ch> <st>` the channel is compared only when the ECU echoes it (a bare `6F 45 01 03` is accepted; the reply layout of FEM_20 is unverified). FRM3-style requests carry the channel in the DID, which is always compared.
- Timeout policy: any request timeout fails the link (late replies cannot be told apart from new ones); the session layer must reconnect and restore.
- ELM: `NO DATA` after the last frame is surfaced as `AdapterError('no-data')`; 0x78 on ELM is followed with `ATMA` monitoring (unverified on hardware); `ATH1` frame lines are assumed to look like `640F1...` (id + data, no spaces).
- ENET discovery packet (type `0x11`) and `DIAGADR..BMWMAC..BMWVIN..` announcement format are from memory of the ENET spec, not from the app evidence.
- `react-native-udp` was last published 2025-10 (4.1.7) and is not maintained for Expo SDK 57, so `discoverEnet()` takes an injectable `createSocket` and returns `[]` without one; a UDP socket must be wired later (or a manual IP entered).
- `react-native-ble-plx` 3.5.1 is an old-architecture bridge module; confirm it runs under RN 0.86 (interop layer) on a dev build before M7.

## Milestones & progress

Status: ☐ todo · ◐ in progress · ☑ done

| #   | Milestone                                                                                                                                | Status |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| M0  | Ignore `PROTO/`, scaffold Expo at root, tooling (ESLint, Prettier, Jest, Husky, CI), project `CLAUDE.md` overrides, this plan            | ☑      |
| M1  | Data pipeline: F-series data → `data/ecu/`, zod schemas, codegen, byte-snapshot tests                                                    | ☑      |
| M2  | Protocol + links: UDS codec, HSFZ/ENET (+UDP discovery), Thor, ELM/ISO-TP, command queue, keepalive                                      | ☑      |
| M3  | Simulator + Demo link with fault injection                                                                                               | ☑      |
| M4  | Domain: XState session, ModuleRegistry, PresetRunner, model-based tests → **user car test**                                              | ☐      |
| M5  | Design canvas: connecting, error, empty states, Library, Cable list → **user checkpoint**                                                | ☐      |
| M6  | UI foundation: gluestack + NativeWind theme from E4 tokens, Geist, Phosphor, i18n EN/PL, navigation skeleton                             | ☐      |
| M7  | Screens: Connect, Settings, Cable, Home, Library, tile menu, favourites edit, preset editor, add step, icon picker → **user checkpoint** | ☐      |
| M8  | Motion: Skia tiles, sweep, wiggle, reorder, haptics, reduced motion                                                                      | ☐      |
| M9  | Hardening: Maestro E2E, coverage gate, security review, code review, performance pass                                                    | ☐      |

### Log

- 2026-10-13 — Grill session complete; plan written. M0 started.
- 2026-10-13 — M0 done: Expo SDK 57 (expo 57.0.28, RN 0.86.3, React 19.2.3, expo-router 57.0.26, TypeScript 6.0.3) scaffolded at repo root with `app/` routes and `src/` skeleton; ESLint 9 + eslint-config-expo + react-hooks + import/order, Prettier 3, jest-expo 57 (Jest 29) with per-dir 90% coverage thresholds activated once `src/protocol|link|domain` contain sources, Husky 9 + lint-staged, GitHub Actions CI, project `CLAUDE.md`. `expo-doctor` 21/21.
- 2026-10-13 — M1 done: `data/ecu/` holds 10 modules (20 files), `ecu_modules.json`, 9 effect packs and `chassis_info.json` filtered to 1906 of 5894 F-series rows; `npm run gen:data` (zod-validated, Prettier-formatted) emits `src/data/generated` and `i18n-keys.json`, `gen:data:check` runs in CI after lint. Elements per module: FEM_20 40, BDC 56, REM_20 16, FRM3 37, FLE02_L/R 11 each, KOMB01/KOMB25 1 each (cluster feedback), LHM2_L/R 0 (see uncertainties); 87 distinct element ids. Effects kept/total: flash 58/68, headlight_flash 22/36, headlight_show 15/15, one_side 16/16, taillight_flash 0/100 (rear-light modules out of scope), taillight_show 7/7, party_mode 9/10, ghost 9/11, toggle 3/11 pairs (139 effects). Generated size about 193 KB (effects 85 KB, vehicles 57 KB, modules 39 KB). Prototype F32/FEM_20 (32) and F10/FRM3 (26) payloads reproduced byte for byte.
- 2026-10-13 — M2 done: `src/transport` (Transport interface, TcpTransport, BleTransport + scan filtered to known adapter service UUIDs, private/link-local host validation), `src/protocol` (bytes, UDS matcher incl. IO-control channel, NRC enum, typed errors, HSFZ/Thor/ISO-TP/ELM codecs, CommandQueue with priority lane, 4 s/12 s timeouts, 0x78 extension and abort, KeepaliveScheduler), `src/link` (BaseLink, HsfzLink, ThorLink, ElmIsoTpLink, `discoverEnet` with injectable UDP). Added react-native-tcp-socket 6.4.3, react-native-ble-plx 3.5.1, buffer 6.0.3, BLE/local-network permission strings in app.json. Coverage on protocol and link above 90 %.
- 2026-10-13 — Dropped-effect audit: all 8 dropped toggle pairs and 3 flash actions (follow-me-home, goodbye, bunch, announcement indicator, maneuvring, special function, locator, remote light, OVT, reversing flash) use `LEUCHTEN_FUNKTION` ids `0x15`-`0x1F` that exist only in G-series BCP_SP21/BDC_G05/BDC_G11 mapping rows, not in any F module in `data/ecu/` (FEM_20/BDC enum ends at `0x13`), so they stay dropped and are documented in `data/ecu/README.md`. Generated output unchanged; counts stay toggle 3/11, flash 58/68 (139 effects).
- 2026-10-13 — M3 done: `src/simulator` (`SimulatedVehicle` built from a chassis profile with default module sets per platform, per-ECU `SimulatedModule` with session state, identity/VIN reads, element/command/return-control handling driven by the generated data, lit-state map, `onStateChange`, request log; `FaultInjector` with latency presets enet/thor/ble, NRC 0x22 by count or probability, 0x78 pending, dropped replies, connection drop by request count or time, ignition-off, seeded RNG) and `src/link/sim-link.ts` (`SimLink` on `BaseLink`, adapter id `demo`, runs through the real CommandQueue and UDS matcher). Simulator behaviours: IO control, routine and write requests need the extended session (else NRC 0x7F); `10 01` and return-control clear forced state; NRC 0x22 only hits actuation services (0x2E/0x2F/0x31); unknown payload NRC 0x31, unknown service 0x11, unknown ECU silent. `src/simulator` added to the 90 % coverage gate.

## How to resume

1. Read this file; find the first ◐/☐ milestone.
2. Check `git log --oneline -20` for the last completed task.
3. Reference prototype code in `PROTO/mobile_proto/src` (codecs/links are worth porting) and protocol evidence in `PROTO/analysis/*.md`.
4. After finishing a task: update the milestone row + add a Log line, run typecheck/lint/tests, commit (include this file).
