# Protocol implementation and evidence

These codecs generate candidate packets from recovered BimmerDisco 3.8 resources. No socket, adapter or vehicle was used to validate them. The target BMW F32 (2016) must identify its fitted ECU; the model alone cannot establish compatibility.

## FEM candidate profile

Local `data/ecu/FEM_20.json` maps front indicators to channels `0D` (left) and `0E` (right). `FEM_20.uds.json` supplies destination `40`, IDENT `22 F1 50`, and digital-output template `2F 45 01 03 00 00`. `ecu_modules.json` associates FEM_20 with SGBD_HEX `0F16B0`, represented as three bytes `0F 16 B0`.

The identity gate deliberately accepts only `62 F1 50 0F 16 B0`. This is a candidate interpretation of the resource identity index, not an observed ECU reply. Additional bytes or another identifier fail closed and require review of an actual read-only identification trace.

The exposed profile contains only IDENT, extended session `10 03`, default session `10 01`, front indicator on/off and return control `2F 45 01 00 FE`. Off differs from returning ECU control. No reset, coding, communication-disable or arbitrary diagnostic payload is exposed by the profile.

## HSFZ / ENET

The recovered builder encodes a four-byte big-endian body length, two-byte control type, then the body. Diagnostics (type `1`) contain source `F4`, destination `40` and UDS bytes. Length includes these two addresses and excludes the six-byte framing header. The network source `F4` differs from the logical/BMWFAST source `F1`.

The parser exposes type `2` ACKs independently of diagnostic responses. It preserves control bodies; ACK success must never satisfy a UDS request. Types `40`–`45` and `FF` denote HSFZ transport errors in [Scapy's primary protocol implementation](https://github.com/secdev/scapy/blob/master/scapy/contrib/automotive/bmw/hsfz.py). Unknown control types remain visible to the client.

Gateway-initiated alive check type `12` receives a type `13` response with raw body `00 F4`, encoded as `00 00 00 02 00 13 00 F4`. This behavior is verified against [EdiabasLib's primary ENET implementation, receive switch](https://github.com/uholeschak/ediabaslib/blob/master/EdiabasLib/EdiabasLib/EdInterfaceEnet.cs). Alive checks operate at the transport layer and do not prove ECU session state. Type `12` may contain zero, two or longer body bytes; the client should use its configured tester address in the reply.

HSFZ diagnostics default to port 6801 from local static evidence and the upstream implementation. Automatic discovery and USB Ethernet routing require separate platform work. The codecs do not select an IP address.

## THOR candidate binary framing

The THOR codec uses physical BMWFAST format: `80 | length`, destination, source, payload and arithmetic byte-sum checksum modulo 256. Lengths 1–63 occupy the low six bits. Longer frames use `80 destination source length8`; if length8 is zero, the following two bytes give big-endian length16. This structure and additive checksum are corroborated by [EdiabasLib's primary OBD implementation](https://github.com/uholeschak/ediabaslib/blob/master/EdiabasLib/EdiabasLib/EdInterfaceObd.cs). The code was implemented independently from these small protocol invariants; no upstream implementation was copied.

The prototype sends source `F1`, destination `40`. Format high bits must be `80`; functional/other formats are rejected. Receive checksum errors fail the stream. A valid packet may still be an adapter echo or unrelated module reply: source/destination filtering is the caller's responsibility. For ECU replies expect source `40` and destination `F1`.

Port 23 is recovered from the shipped THOR constructor. Adapter initialization, firmware variations, configured Wi-Fi IP, TCP behavior and actual BMWFAST acceptance have not been live verified. This codec is an experimental direct binary route. It does not implement ELM AT configuration or guess a universal adapter initialization sequence. It does not establish that every adapter named THOR works with this route.

## Streaming and response matching

Both parsers consume fragmented or coalesced packets using a fixed receive buffer. HSFZ body and THOR UDS payload limits are 4096 bytes. Declared oversized frames are rejected before buffering their bodies; malformed frames clear parser state and throw. The caller should close a failed connection and avoid blindly retrying actuation. Reset clears partial data on disconnect. Returned packet data is copied, so later input cannot mutate an earlier packet.

`matchUdsResponse` requires positive service `request service + 40`, matching DID for IDENT, session subfunction for session control, and DID/control parameter for IO control. Subsequent IO status bytes are opaque: the protocol does not define a universal channel echo, as illustrated by [udsoncan's IO-control parser](https://github.com/pylessard/python-udsoncan/blob/master/udsoncan/services/InputOutputControlByIdentifier.py). A bare `6F 45 01 03` therefore acknowledges adjustment without interpreting lamp status. A reply does not prove a lamp physically illuminated. Actual FEM_20 status-record layout remains unverified.

Negative replies must be exactly `7F request-service NRC`. `78` means pending and keeps the current request outstanding; all other matching negative codes fail the operation. Negative replies have no DID/channel correlation, so the client must serialize requests, enforce response addresses, bound pending time, avoid retries on uncertain execution, and disconnect after timeout. UDS contains no transaction ID: late replies to identical requests cannot be distinguished by this codec.

Offline tests use exact independently specified fixture bytes, all fragmentation split points, coalesced streams, extended THOR lengths, invalid lengths/checksums, identity mismatches and unrelated UDS replies. No test opens a network connection or sends a vehicle command.
