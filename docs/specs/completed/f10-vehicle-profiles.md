# F10/F11 support via vehicle profiles

Goal: support BMW F10/F11 alongside F32 while presets stay vehicle-agnostic. A preset uses
generic element IDs (`frontLeftIndicator`, …); the identified vehicle profile translates each
element into its own UDS bytes at run time. One preset file, one preview, any supported car.

Evidence: `analysis/f10-findings.md` (static analysis only, unverified on a car).

## Profiles (`mobile/src/protocol/profiles.ts`, replaces the FEM-only wiring)

| | F32 | F10/F11 |
|---|---|---|
| ECU | FEM_20 | FRM3 |
| Address | `0x40` | `0x72` |
| Identify | `22 F1 50` → `62 F1 50 0F 16 B0` | `22 F1 50` → `62 F1 50 0F 10 D0` (medium confidence) |
| Session | `10 03` / `10 01` | `10 03` / `10 01` |
| Front left on/off | `2F 45 01 03 0D 01/00` | `2F 01 1C 03 64` / `2F 01 1C 03 00` |
| Front right on/off | `2F 45 01 03 0E 01/00` | `2F 01 1D 03 64` / `2F 01 1D 03 00` |
| Return control | `2F 45 01 00 FE` | none in app data — rely on per-light off + `10 01` |

Profile shape: `{ id, chassis label, ecu name, address, identity bytes, elements: Partial<Record<ElementId, (on) => bytes>>, returnControl: bytes[] }`.
Elements missing from a profile are unsupported on that car.

## Auto-detection

Connect, then probe profiles in order F32 (`0x40`) → F10 (`0x72`) with `22 F1 50`.
On an F10, `0x40` is CAS and answers with a non-matching identity, so probing continues without
a timeout. First exact identity match selects the profile; no match → locked "controller mismatch",
log every identity read. Negative/non-matching replies must not tear down the connection.

## Transport

Destination address becomes a per-request parameter (`DiagnosticLink.request(payload, address)`);
HSFZ/THOR encoders take it, reply filters in `wire-link.ts` accept the reply only from the
addressed ECU. Demo link answers identities for the F32 profile.

## Session / presets

- Session state exposes the detected profile (`vehicle`); `pulse`, `restore`, `playPreset`
  use its address and element map; cleanup = off for touched lights, profile return-control, `10 01`.
- `playPreset` skips elements the profile doesn't support and logs it (never fails the preset).
- Preset schema unchanged. Editor/presets screen may mark elements unsupported on the
  connected vehicle; no per-vehicle presets.
- Home screen: header/labels come from the detected profile ("BMW F32 · FEM_20", "BMW F10/F11 · FRM3");
  before identification, show "BMW F32 / F10 / F11".

## Tests

Profile byte tables, probe order (F10 path via CAS mismatch at 0x40), reply-source filtering for
0x72, preset translation to each profile's bytes, unsupported-element skip, cleanup per profile.
