# TODO

## Widgets and live status

Decisions:

- Widgets are launchers, not background connections. Neither platform can run the JS UDS stack inside a widget, and background polling would wake the car's ECUs and drain its battery.
- A widget tap opens the app, auto-connects with the saved cable, and runs a preset only once the car is ready. The user always sees what is running, and the Safety policy (forced control undone) still applies.
- Widgets show the last known state ("F32 · last connected 2 h ago", cable), never a live state.

### Shared groundwork

- [ ] Deep links: `bimmerdisco://connect` and `bimmerdisco://run/<presetId>`. Open the app, auto-connect with the saved adapter settings, and run the preset once the session is `ready`.
- [ ] Persist the last known state (chassis, last connected time, adapter) to shared storage that the widgets can read. Reload the widget timelines whenever it changes.
- [ ] Widget-safe favourites snapshot: ids, names, icons and colours of up to 4 favourites.

### iOS

- [ ] Widget extension (SwiftUI, small and medium sizes, Lock Screen) via `@bacons/apple-targets`, with an App Group for the shared storage, read and written by a small local Expo module.
- [ ] Widget content: a Connect button, 2–4 favourite preset buttons that open the deep links, and a last-known status line.
- [ ] iOS 18 Control Center / Lock Screen control: "Connect to car" and "Run favourite".
- [ ] Live Activity while a session is connected: "Connected · F32" plus a Stop button. Its lifetime is limited by how long the app stays connected in the background (short by design today).

### Android

- [ ] Get the Android build compiling and running on a device or emulator first (never compiled yet).
- [ ] Home-screen widget via `react-native-android-widget` (JSX, Expo config plugin): same Connect and favourite buttons through the deep links, last-known status line.
- [ ] Foreground service with an ongoing notification while connected: "Connected · F32" with Stop and Disconnect actions (Android 16 Live Updates where available).
- [ ] Decide: should a running preset continue in the background on Android while the foreground service holds the session? Forced control must still be undone on finish or Stop.

## Preset editor

- [ ] Revamp the Edit preset screen (scope to be defined).

## Other open items

- [ ] Chassis detection: F20/F30/F32 share the same modules, so `rankChassis` ties and picks F20. Derive the chassis from the VIN and use module ranking only as a fallback.
- [ ] Sentry: set `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` in `.env` (local release builds) and as EAS environment variables (preview/production); dev runs keep upload disabled. Update the App Store privacy declaration (crash data and feedback are now collected).
