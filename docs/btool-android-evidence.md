# Android connection investigation — 2026-10-15

## Artifact and evidence boundary

User report: Bluetooth vGate fails at the first adapter step on Android; iOS THOR works. The exact vGate model and whether it was using BLE or Classic are unknown. This investigation establishes implementation differences, not a confirmed hardware root cause.

- Original APK: `C:/Users/kules/Downloads/btool-app-39010-litengp-release.apk`.
- SHA-256: `173830cff48f9448f7bf81cc69ba70c317adb641ea1da7ac32783686debb7f11`.
- Extracted reference: `btool-apk/` (gitignored, excluded from app tooling).
- REA archive inspection succeeded in the analysis worker: Evidence `ev_ae6f61ab9f214d4a729df946b172d2376e02aaae5a677c95664f55c71855cbf0`. This establishes archive identity/inventory only. Its retained ledger is worker-session scoped, not accessible from the parent session.
- REA Android decompilation was unavailable because its caller-supplied JADX MCP 0.7.1 provider JAR was not configured. No Java/JADX installation was available. Method-level evidence below comes from **Androguard DEX disassembly**, not REA decompilation or runtime observation.
- Reproducible local extraction script: `btool-apk/dump_connections.py`; output `btool-apk/connection-disassembly.txt`. The following locations refer to that output after the final expanded extraction. Class/method identities are the stable references if the output is regenerated.

## Observed transport behavior

| Family            | Artifact evidence                                                                                                                                                                                                                                                                                                                                             | App implementation                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bluetooth Classic | `ConnectionType` at line 6942 includes BT separately from BLE. `ConnectTask$BTSocketConnector` at line 5069 cancels discovery, opens insecure RFCOMM with SPP UUID `00001101-0000-1000-8000-00805F9B34FB`, then falls back to RFCOMM channel 1.                                                                                                               | Android-only paired-device picker and native RFCOMM transport. Discovery cancellation is attempted when its permission is available.                                                                                |
| BLE               | `BleUart` at line 7301: FFF0 service, FFF1 receive/notifications, FFF2 transmit, CCCD 2902. `BleUart$1.onServicesDiscovered` enables notifications and writes CCCD. `send` uses normal characteristic writes, without an explicit MTU request.                                                                                                                | Existing FFF0 profile retained; Android uses 20-byte chunks and acknowledged writes when supported. iOS write preference/MTU sizing retained. Known service UUID now required at profile selection.                 |
| USB serial        | `ConnectTask.connectUsbSerialPort` at lines 6152/6259: USB permission, automatic felhr driver selection or explicit FTDI, 8 data bits/1 stop bit/no flow control; baud/parity supplied by protocol. `ObdDCanProtocol` at line 11407: **115200 baud, no parity**, identity request formatting, additive checksum parser, init succeeds without extra commands. | Android-only USB host transport using usb-serial-for-android 3.11.0, default driver probing, 115200/8N1 and BMW-FAST framing through `ThorLink`. BTOOL's manual FTDI override is not exposed.                       |
| Network           | `ActivityConnection.<clinit>` (line 307 onward): ELM defaults `192.168.0.10:35000`; raw OBD K+DCAN defaults `192.168.4.1:23`. `ConnectTask.connectNetSerialPort` at line 6052 uses a normal TCP socket with a 2000 ms connect timeout. No network binding call appears in this method.                                                                        | Separate ELM Wi-Fi and THOR paths; THOR defaults to `192.168.4.1:23` on fresh Android settings, existing saved hosts retained. iOS default remains `192.168.0.10:23`. ENET keeps existing HSFZ/6801 implementation. |

USB library reference: [upstream README](https://github.com/mik3y/usb-serial-for-android) documents supported driver families, JitPack dependency and port configuration. This is a new implementation of the transport contract, not a copy of felhr or BTOOL's implementation.

## Default ELM D-CAN behavior

`CarAdapterFactory` (line 7800) selects mode 2 for the default/autodetect branch. Other modes and older DS2/KWP protocols also exist; they are not required for this app's F-series UDS scope and are not imported as separate UI modes.

`ElmProtocol.init` (class begins at line 8401) sends `ATI` twice before the initialization array. The first exchange wakes/drains the adapter; the second must produce a nonempty answer. The previous app started with `ATZ` and a banner regex.

`ElmDCanMode2Protocol` (line 9738) initializes with:

```text
ATD ATE0 ATS0 ATL0 ATAL ATAT0 ATH1
ATPB C101 ATCRA 612 ATSH 6F1 ATFC SH6F1
ATFCSD 12300002 ATFC SM1 ATCEA 12
ATCM 600 ATCF 600 ATSP B ATBI ATAT0
```

Its `send` method changes target with `ATCEA <ecu>`, `ATCRA 6<ecu>`, `ATFCSD <ecu>300002`. For UDS payloads up to six bytes, it sends **UDS only** with CAF1: ELM inserts target and PCI. For longer payloads it switches to CAF0 and sends seven-byte PCI/data records; **ATCEA still inserts the ECU byte**. Consecutive records use six data bytes with zero padding, honor flow control, and wait at least 50 ms between records. Returning to short requests restores CAF1. Headers remain on for response address matching/reassembly.

Implemented as opt-in `android-mode2` in `ElmIsoTpLink`, selected by Android native dependencies for BLE and by the new Android Classic/Wi-Fi choices. The existing `legacy` profile remains the default and the iOS selection. Single-frame, multi-frame, formatting transitions, negative initialization and unchanged legacy behavior are tested. Initialization acknowledgements are required; an unsupported adapter fails closed.

## Inferences and limits

- A Classic-only vGate could not work through the old BLE-only choice. That is a plausible explanation, not confirmed for the user's device.
- Android BLE initialization/framing now follows the observed default mode, but no car session was captured. Notification enable timing, adapter firmware compatibility and real ISO-TP timing still need hardware validation.
- BLE notification registration uses ble-plx; it has no completion promise for CCCD setup. No arbitrary delay is presented as a guaranteed readiness fix. BTOOL itself signals service readiness after submitting its descriptor write rather than awaiting an observed descriptor callback in the inspected class.
- ENET transport and the working iOS THOR framing remain unchanged. No claim is made that BTOOL ENET discovery or all older-car protocol modes have been replicated.
- Shared session serialization, background restoration, reconnect restoration and forced-control safety remain in use for every new link.
- Android native module is discovered by Expo autolinking and Android prebuild succeeds. Kotlin compilation and hardware behavior remain unverified here because Java/Android SDK and a connected adapter are unavailable.

## Device verification

1. Rebuild/install the Android native app (a JS reload cannot add the native serial module).
2. For Classic vGate, pair in Android Bluetooth settings, then choose **ELM327 Bluetooth** and the paired device. For a BLE version choose **Vgate iCar** and its BLE discovery result.
3. Verify adapter initialization, car identification, a known working hazard action, Stop, background restore, disconnect, and reconnect.
4. Test ELM Wi-Fi on the adapter WLAN with its host/port; test THOR/raw K+DCAN with its own endpoint; test USB with OTG and accept the Android USB permission dialog.
5. If initialization still fails, copy the diagnostic log and record exact adapter model, Android version and the failing step before changing protocol settings.
