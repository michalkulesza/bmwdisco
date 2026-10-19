# Android connection implementation notes

Android supports the adapter transports listed below. These notes describe the current implementation and identify behavior that still needs device validation.

| Transport         | Current implementation                                                                          | Validation status                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Bluetooth Classic | Paired RFCOMM SPP transport.                                                                    | Native compilation and a real adapter session remain pending.             |
| BLE               | Known adapter service profile, 20-byte Android chunks, and acknowledged writes where supported. | Adapter firmware compatibility and notification timing remain unverified. |
| USB serial        | Android USB host transport with driver probing, 115200/8N1, and BMW-FAST framing.               | Native compilation and a connected adapter session remain pending.        |
| ELM Wi-Fi         | Separate TCP transport; fresh Android settings default to `192.168.0.10:35000`.                 | Hardware validation remains pending.                                      |
| THOR / raw K+DCAN | BMW-FAST over TCP; fresh Android THOR settings default to `192.168.4.1:23`.                     | Hardware validation remains pending.                                      |

The Android ELM mode supports the configured D-CAN initialization sequence and ISO-TP single- and multi-frame requests. Short requests use adapter-generated framing; longer requests switch to explicit PCI/data records and return to the short-request format afterward. Adapter acknowledgements are required during initialization; unsupported commands fail closed. The iOS legacy ELM profile remains the default there.

A Classic-only adapter would not work through a BLE-only connection choice, but the reported adapter model and radio type are unknown, so this remains a possible explanation for prior connection failures. No car session or real-adapter capture has verified Android timing or compatibility.

For device verification, build and install the Android native app, connect using the adapter's matching transport, then check initialization, car identification, a known light action, Stop, background restoration, disconnect, and reconnect. If initialization fails, record the exact adapter model, Android version, and failing step before changing protocol settings.
