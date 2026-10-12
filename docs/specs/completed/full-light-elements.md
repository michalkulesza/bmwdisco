# Full light element list + native multi-select menu

Goal: expose every known light output (not just front indicators) as generic preset elements,
mapped per vehicle profile, and replace the per-block checkbox rows with a native iOS pull-down
menu with checkmarks.

Evidence: `analysis/light-elements.md` (static analysis; ends with the TS element table — use only
its medium/high entries, exactly as listed).

## Elements

- `src/presets.ts`: `LIGHT_ELEMENTS` becomes the full generic list `{ id, label, group }` from the
  table (group order: Indicators, Front, Fog, Rear, Interior). Existing IDs `frontLeftIndicator` /
  `frontRightIndicator` keep their names so saved presets and files stay valid. Schema version stays 1.
- `src/protocol/profiles.ts`: each profile's `elements` map holds `{ on: bytes, off: bytes }` per
  supported ID (from the table's `f32` / `f10` columns). Elements absent from a profile are unsupported
  on that car — skipped and logged at playback (existing behaviour).
- F32 aggregate elements (`2E D5 42 …`, WriteDataByIdentifier, time field) are allowed: response
  matching must accept their positive reply (`6E D5 42`). Cleanup still sends `off` for every touched
  element, then profile return-control, then `10 01`.
- The home-screen 1-second pulse test stays on the front indicators.

## Editor UI (light block)

- Replace the checkbox `Pressable` rows with an `@expo/ui/swift-ui` `Menu` inside a `Host`:
  label = selection summary ("Front left indicator, Front right indicator" / "3 lights" / "Choose lights"),
  one `Section` per group, one `Toggle` per element (`isOn` = selected) — renders as checkmarks.
  Apply `menuActionDismissBehavior('disabled')` so several lights can be ticked without reopening.
- When connected to an identified vehicle, elements it doesn't support are still listed but labelled
  "(not on <chassis>)"; never hidden — presets are vehicle-agnostic.
- Disabled while busy. Keep On/Off switch, delay block, and screen styling as is.
- The playback `Lights` tiles (only 2 arrows today) become a compact list of the currently-on element
  labels, grouped, so it scales to the full list.

## Native build

`@expo/ui` is a native module: `npx expo prebuild --clean --platform ios` then rebuild.

## Tests

Profile tables (spot-check bytes per shape), preset with a mix of F32-only/F10-only elements translates
and skips correctly on each profile, `6E D5 42` reply matching, parsing older files with the two
indicator IDs still works.
