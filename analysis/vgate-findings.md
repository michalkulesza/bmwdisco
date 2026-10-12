# BimmerLight Vgate iCar / ELM BLE support - findings
(see final summary; evidence: EdiabasKit binary, VAs below, decoded via otool -tv + Swift static array dump)

Adapter classes (BluetoothServiceBase subclasses): UniCarScan, OBDLink, OBDLink MX, Konnwei, vLinker, VgateIcar, Veepeak, BimmerCommander.
AdapterConfig fields (EdiabasKit.strings.txt 0x11d8d0..): adapterName, initialAtCommands, targetWriteUUIDs, targetNotifyUUIDs, useWriteCharacteristicFallback, sleepAfterAddressConfig, addressCommands.
Vgate config built in once-init fn 0x18a74: name "VgateIcar"; write UUIDs [BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F]; notify [BEF8D6C9-..., 2AF0]; fallback=false; sleepAfterAddressConfig=true(byte 0x01); addressCommands closure 0x18c80.
initialAtCommands (array @0x147b18, 13): ATZ ATE0 ATS0 ATL0 ATH1 ATAL ATCAF0 ATPBE101 ATSPB ATBI ATAT2 ATFCSH6F1 ATSH6F1 (identical for Veepeak @0x147a20).
Vgate addressCommands(ecuHex): ["ATFCSD"+ecu+"30FF08" (arg order medium confidence), "ATFCSM1", "ATCRA6"+ecu, "ATCEA"+ecu].
STN adapters (OBDLink/vLinker closure 0x17cf0): STCSEGT1, STCFCPC, STCFCPA 6.., ATSH.., ATCRA6<ecu>, ATCEA<ecu>.
OBD-like service scan list fn 0x1e65c: 18F0, FFE0, E7810A71-73AE-499D-8C15-FAA9AEF0C3F2, BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F.
Konnwei/Veepeak/BimmerCommander use FFF1/FFF2; vLinker 2AF0/2AF1.
Info.plist: NSBluetoothAlwaysUsageDescription, NSBluetoothPeripheralUsageDescription, UIBackgroundModes [bluetooth-central, external-accessory], UISupportedExternalAccessoryProtocols [com.obdlink] (OBDLink only).
