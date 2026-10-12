# BimmerDisco: iPhone prototype

Expo SDK 57 / Expo Router prototype for a **2016 BMW F32** (FEM_20) and **BMW F10/F11** (FRM3, unverified on a car), intended for an **iPhone 15 Pro** with an ENET cable through USB-C Ethernet or a THOR Wi-Fi adapter. Native TCP uses `react-native-tcp-socket` 6.4.3.

**No vehicle or adapter hardware has validated this implementation.** Protocol behavior comes from the repository's static artifact analysis. A successful demo or unit test does not establish vehicle compatibility. This prototype only identifies the FEM and offers one-second front left/right indicator tests; it has no flashing, coding, fault clearing, or arbitrary command entry. Lighting presets are limited to the two front indicators (see below).

## Prepare the Mac

1. Install Node.js 24 LTS (24.3 or newer), npm, and Xcode with iOS platform support. Open Xcode once to finish installing components and accept its license. Select the installed Xcode in Xcode Settings > Locations > Command Line Tools. Have CocoaPods available for native dependency installation.
2. In Xcode Settings > Accounts, sign in with the Apple ID attached to your Apple Developer Program membership.
3. Connect the iPhone to the Mac by USB, unlock it, trust the Mac, and enable Settings > Privacy & Security > Developer Mode when prompted; restart and confirm if requested. See [Apple's Developer Mode instructions](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device/).
4. Copy or clone this repository onto the Mac. From its root:

```sh
cd mobile
npm ci
npm test
npm run typecheck
```

Keep the lockfile: `npm ci` installs the versions used by this prototype. These checks exercise simulated protocol/session behavior and TypeScript; they do not contact a car.

Only the `mobile` folder is needed to build; omit Windows `node_modules`, `.expo`, and `dist` when transferring. The supplied ZIP contains the portable source and lockfile.

## Try the simulated flow

```sh
npm start
```

In the Expo terminal, switch the launch target to Expo Go with `s` if it defaults to a development build, then scan the QR code with the iPhone. Use an Expo Go version compatible with SDK 57. Keep the Mac and iPhone on a reachable network. Choose **Demo**, then **Connect & identify**, and try either indicator button. Logs in this mode are simulated and no vehicle connection is made.

Expo Go cannot provide this app's native TCP module. ENET and THOR require your own iOS build. [Expo explains development builds and native libraries](https://docs.expo.dev/develop/development-builds/introduction/).

## Install your native iPhone build

Before the first build, check `expo.ios.bundleIdentifier` in [app.json](app.json). The supplied value is `com.kules.bimmerdisco`; change it to a unique identifier available to your developer team if needed.

```sh
npm run ios
```

This runs `expo run:ios --device`. Select the connected iPhone 15 Pro. Expo generates the ignored `ios/` project on the first run, installs native dependencies, compiles and installs the app, and starts Metro. Initial downloads and Apple signing need internet access. [Expo documents local compilation](https://docs.expo.dev/guides/local-app-development/).

If signing fails, open the generated `.xcworkspace` under `mobile/ios/` in Xcode. Select the app target > Signing & Capabilities, enable **Automatically manage signing**, choose your paid developer team, and confirm the bundle identifier matches your app configuration. Select your iPhone as the run destination and let Xcode resolve registration/provisioning issues. Retry `npm run ios`. See [Apple's device signing workflow](https://help.apple.com/xcode/mac/current/en.lproj/dev5a825a1ca.html) and [Expo's device signing instructions](https://docs.expo.dev/more/expo-cli/#ios-development-signing).

The debug build normally loads JavaScript from Metro. It is useful at your desk but awkward when the phone is connected to the car's isolated network. For car-side use, build and install the Release configuration **before leaving the Mac**:

```sh
npm run ios:release
```

This runs `expo run:ios --device --configuration Release`. It embeds the JavaScript/assets so the installed app can start without Metro or internet. It still requires valid device signing; this command does not create an App Store submission. [Expo documents the Release configuration](https://docs.expo.dev/more/expo-cli/#compiling-ios).

Stop Metro, unplug the iPhone from the Mac, and relaunch BimmerDisco from its Home Screen. Confirm the Demo flow works with the Mac unreachable before going to the car. Rebuild Release after changing application code. Native dependency or `app.json` changes also require regenerating the native project and rebuilding; preserve any manual native changes before regeneration.

## Connect an adapter

Use one adapter at a time. Park the vehicle, keep it stationary with ignition on, and keep the app in the foreground. Close other diagnostic apps so they do not compete for the adapter/session.

| App mode | Physical connection | Candidate destination | TCP port |
| --- | --- | --- | --- |
| ENET | Vehicle OBD → ENET cable → USB-C Ethernet adapter → iPhone | `169.254.250.250` | `6801` |
| THOR | THOR in vehicle OBD; iPhone joined to the adapter's Wi-Fi | `192.168.4.1` | `23` |

These addresses and ports are **manual candidates**, not detected or hardware-verified endpoints. Confirm your adapter/vehicle's actual destination and edit the fields if different. There is no automatic discovery or subnet scanning.

For ENET, inspect the iPhone's Ethernet settings after connecting. An address assigned to the **iPhone** is its own local address; do not enter it as the app's Host. Host must be the remote vehicle gateway address. A link-local `169.254.x.x` iPhone address alone does not prove that `169.254.250.250` is the gateway. Use established adapter/network information to determine the remote endpoint rather than copying the phone's assigned IP or guessing a static phone configuration.

For THOR, join the adapter's actual SSID using its supplied credentials. A **No Internet Connection** indication is expected for an isolated adapter network; remain connected to it. The phone's Wi-Fi IP Address is the phone's address, while Host is the remote THOR adapter address. Use the Release build so Metro access is unnecessary.

Allow BimmerDisco's **Local Network** prompt. If denied, enable it in Settings > Privacy & Security > Local Network and retry. `app.json` includes the local-network usage description. [Apple documents this permission](https://support.apple.com/102229).

## First car-side test

1. Open the installed Release app, select ENET or THOR, and verify Host and TCP port.
2. Tap **Connect & identify**. The app reads `22 F1 50` at `0x40` (F32 FEM_20, expects `0F16B0`), then at `0x72` (F10/F11 FRM3, expects `0F10D0`), and unlocks tests only on an exact match. The F10/F11 identity and commands come from static analysis alone (`analysis/f10-findings.md`); confirm them on the car. Presets are vehicle-agnostic: the detected vehicle translates each light block into its own commands. A mismatch stays locked. Do not substitute another identity to bypass the check.
3. With the vehicle stationary and a clear view of its front indicators, tap **Front left** once. Wait for the one-second pulse and the restoration acknowledgement before trying **Front right**.
4. Each test requests extended diagnostic session, drives the selected front indicator on for one second, requests off, then attempts return-control (`2F 45 01 00 FE`) and default session (`10 01`). The one-second interval begins after the on-request acknowledgement; network/ECU delays can affect observed duration.
5. **Stop & restore control** cancels the wait and attempts cleanup after the current reply. **Restore ECU control** retries restoration while verified and connected. Backgrounding requests stop; keep the app open through cleanup. Lost connectivity or process termination can prevent restoration, so only an acknowledged cleanup confirms it.
6. If identity, output behavior, or restoration is unexpected, stop testing and export the session log. If restoration is reported unconfirmed, do not assume the ECU accepted it; reconnect and identify before using the restore control. Finish with **Disconnect** after restoration succeeds.

Use **Export logs** to share the timestamped session trace through the iOS share sheet. Retain the adapter model, mode, entered endpoint, identity reply, and observed lamp behavior alongside the trace when investigating a failure.

## Lighting presets

A preset is a sequence of blocks for the two front indicators (`frontLeftIndicator`, `frontRightIndicator`): **set** blocks turn selected indicators on or off, and **wait** blocks pause for 50–2000 ms. Presets are saved on the device and managed from the presets screen.

- **Preview in Demo** runs a preset on the simulated connection; no vehicle commands are sent.
- **Run on car** is enabled only after the car is connected and identified. A preset runs once, then ECU control is restored. **Stop & restore control** cancels playback.
- Limits: 200 blocks per preset, 60 seconds of total delay, 100 presets, and a 1 MB import file.

Export shares one preset or all presets as JSON; import reads the same format:

```json
{
  "schemaVersion": 1,
  "presets": [
    {
      "id": "blink-left",
      "name": "Blink left",
      "steps": [
        { "type": "set", "elements": ["frontLeftIndicator"], "state": "on" },
        { "type": "wait", "durationMs": 500 },
        { "type": "set", "elements": ["frontLeftIndicator"], "state": "off" }
      ]
    }
  ]
}
```

## Troubleshooting and evidence

Development verification on Windows: protocol/session tests, TypeScript checking and `npx expo export --platform ios` pass. Expo Doctor passes 20 of 21 checks; its remaining warning is **react-native-tcp-socket is untested on React Native's New Architecture**. That warning is not suppressed. A successful JavaScript export does not validate native compilation, socket-library compatibility, iOS permissions/routing, or vehicle behavior. Verify the native build on your Mac and phone before treating the transport as working.

`npm audit` reports 28 dependency findings (18 high, 10 moderate), including transitive Expo/Metro tooling and Router dependencies. Compatible automatic fixes were applied; remaining suggested fixes change the Expo SDK/Router major versions. Those breaking changes were not applied. This dependency set is a prototype baseline, not a production security sign-off.

- **Native module missing:** install the custom native build; Expo Go supports Demo only. Rebuild after native dependency changes.
- **Cannot load JavaScript at the car:** install Release while at the Mac and verify a cold launch without Metro.
- **Timeout/refused connection:** check physical connections, ignition, selected adapter network, Local Network permission, and the actual remote host/port. A TCP connection alone does not prove a valid diagnostic response.
- **Identity mismatch:** the prototype is limited to the exact FEM_20 / FRM3 identities above; every identity read is logged with its address. Keep tests disabled and export the reply for review.
- **Negative response or unconfirmed restoration:** preserve the log and stop further output testing until the response and physical vehicle state are understood.

The portable [protocol notes](docs/protocol-notes.md) describe packet layouts and remaining uncertainties. The full workspace also contains [protocol findings](../analysis/protocol-findings.md), [command findings](../analysis/command-findings.md), and [connection inventory](../analysis/connection-inventory.md); those larger reverse-engineering files are not required to build. No live commands were sent to a vehicle during development of this handoff. Official Expo and Apple build instructions linked above were checked on 2026-10-12; a Mac build and physical-car validation remain required.
