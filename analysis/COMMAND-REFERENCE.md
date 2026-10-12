# BimmerLight symbolic command reference

This table covers all **255 nonempty distinct command IDs** in the supplied app resources. Meanings come from the English IDs, mapped descriptions and diagnostic schemas. Counts show how many distinct ECU variants contain a mapping; they do not prove support on a particular car, UI availability, or live ECU acceptance. The same ID can require different payloads and channels on different variants.

Numeric LED/group IDs have ECU-specific physical assignments. `LCI_*`, `OVT` and `BUNCH_LIGHT` are retained without invented expansions. `CC_*` entries are communication-control commands. `INVALID`, `NONE` and the empty command are selector/sentinel values rather than user light features. Standard CommunicationControl byte meanings are corroborated by [udsoncan’s service implementation](https://udsoncan.readthedocs.io/en/latest/_modules/udsoncan/services/CommunicationControl.html); vehicle acceptance remains untested.

For exact mapping arguments, templates and all ECU variants, use [command-catalog.csv](command-catalog.csv) or [command-catalog.json](command-catalog.json). For assembly examples, reset/release distinctions and limitations, use [command-findings.md](command-findings.md). The source column links to one representative mapping; its line number identifies the command key.

| Command ID | Meaning | ECU variants (count; examples) | Representative source |
|---|---|---|---|
| `ALL` | All outputs/channels exposed by this ECU mapping. | 3; BDC, BDC_G11, FEM_20 | [FEM_20.json](decrypted/FEM_20.json), line 380 |
| `ALL_LEFT` | All mapped left headlight channels; scope depends on ECU. | 7; FLE02_L, FLE_L, FLM01_L, FLM02X_L … | [FLE02_L.json](decrypted/FLE02_L.json), line 136 |
| `ALL_LEFT_1_LEFT` | All mapped channels of the identified rear-light module; physical grouping depends on ECU. | 2; RLM2_1L, RLM_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 262 |
| `ALL_LEFT_2_LEFT` | All mapped channels of the identified rear-light module; physical grouping depends on ECU. | 2; RLM2_2L, RLM_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 262 |
| `ALL_OFF` | Clear the mapped output mask / all mapped outputs off. | 8; LCM, LCM_A, LCM_II, LCM_III … | [LCM.json](decrypted/LCM.json), line 256 |
| `ALL_RIGHT` | All mapped right headlight channels; scope depends on ECU. | 7; FLE02_R, FLE_R, FLM01_R, FLM02X_R … | [FLE02_R.json](decrypted/FLE02_R.json), line 136 |
| `ALL_RIGHT_1_RIGHT` | All mapped channels of the identified rear-light module; physical grouping depends on ECU. | 2; RLM2_1R, RLM_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 262 |
| `ALL_RIGHT_2_RIGHT` | All mapped channels of the identified rear-light module; physical grouping depends on ECU. | 2; RLM2_2R, RLM_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 262 |
| `AMBIENT` | Ambient illumination; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 281 |
| `AMBIENT_1` | Ambient-light channel 1; exact location depends on ECU. | 1; FRM3 | [FRM3.json](decrypted/FRM3.json), line 391 |
| `AMBIENT_2` | Ambient-light channel 2; exact location depends on ECU. | 2; BDC_G11, FRM3 | [BDC_G11.json](decrypted/BDC_G11.json), line 869 |
| `ANNOUNCEMENT_INDICATOR_LIGHT` | Named announcement-indicator light function; exact pattern depends on ECU. | 2; BCP_SP21, BDC_G05 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 816 |
| `BIXENON_LEFT` | Left bi-xenon output; exact shutter/lamp assignment depends on ECU. | 3; BDC, BDC_G11, FEM_20 | [FEM_20.json](decrypted/FEM_20.json), line 182 |
| `BIXENON_RIGHT` | Right bi-xenon output; exact shutter/lamp assignment depends on ECU. | 3; BDC, BDC_G11, FEM_20 | [FEM_20.json](decrypted/FEM_20.json), line 193 |
| `BI_XENON` | Bi-xenon shutter output, both sides where the mapping specifies L+R. | 5; FRM3, FRM_70, LM2_83, LM_AHL_2 … | [FRM3.json](decrypted/FRM3.json), line 149 |
| `BOOTLID_LEFT` | Bootlid light output — left; exact output depends on ECU. | 19; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 328 |
| `BOOTLID_RIGHT` | Bootlid light output — right; exact output depends on ECU. | 19; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 342 |
| `BRAKE` | Brake light; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 545 |
| `BRAKE_CENTER` | Brake light — center; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 174 |
| `BRAKE_FORCE_DISPLAY` | Brake-force display / emergency-stop-signaling light function. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 558 |
| `BRAKE_FORCE_DISPLAY_LEFT` | Brake-force-display light — left; exact output depends on ECU. | 7; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 188 |
| `BRAKE_FORCE_DISPLAY_RIGHT` | Brake-force-display light — right; exact output depends on ECU. | 7; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 202 |
| `BRAKE_LEFT` | Brake light — left; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 146 |
| `BRAKE_LEFT_2` | Brake light — left 2; exact output depends on ECU. | 2; FRM3, LM_AHL_2 | [FRM3.json](decrypted/FRM3.json), line 435 |
| `BRAKE_RIGHT` | Brake light — right; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 160 |
| `BRAKE_RIGHT_2` | Brake light — right 2; exact output depends on ECU. | 2; FRM3, LM_AHL_2 | [FRM3.json](decrypted/FRM3.json), line 446 |
| `BUNCH_LIGHT` | Named BUNCH_LIGHT light function; physical meaning unknown. | 2; BCP_SP21, BDC_G05 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 920 |
| `CC_00_01` | CommunicationControl 28 00 01: enable receive/transmit, normal messages; not a cluster warning. | 16; FLE02_L, FLE02_R, FLE_L, FLE_R … | [FLE02_L.json](decrypted/FLE02_L.json), line 203 |
| `CC_00_02` | CommunicationControl 28 00 02: enable receive/transmit, network-management messages; not a cluster warning. | 16; FLE02_L, FLE02_R, FLE_L, FLE_R … | [FLE02_L.json](decrypted/FLE02_L.json), line 214 |
| `CC_00_03` | CommunicationControl 28 00 03: enable receive/transmit, both message types; not a cluster warning. | 16; FLE02_L, FLE02_R, FLE_L, FLE_R … | [FLE02_L.json](decrypted/FLE02_L.json), line 225 |
| `CC_01_01` | CommunicationControl 28 01 01: enable receive, disable transmit, normal messages; not a cluster warning. | 16; FLE02_L, FLE02_R, FLE_L, FLE_R … | [FLE02_L.json](decrypted/FLE02_L.json), line 236 |
| `CC_01_02` | CommunicationControl 28 01 02: enable receive, disable transmit, network-management messages; not a cluster warning. | 16; FLE02_L, FLE02_R, FLE_L, FLE_R … | [FLE02_L.json](decrypted/FLE02_L.json), line 247 |
| `CC_01_03` | CommunicationControl 28 01 03: enable receive, disable transmit, both message types; not a cluster warning. | 16; FLE02_L, FLE02_R, FLE_L, FLE_R … | [FLE02_L.json](decrypted/FLE02_L.json), line 258 |
| `CC_02_01` | CommunicationControl 28 02 01: disable receive, enable transmit, normal messages; not a cluster warning. | 16; FLE02_L, FLE02_R, FLE_L, FLE_R … | [FLE02_L.json](decrypted/FLE02_L.json), line 269 |
| `CC_02_02` | CommunicationControl 28 02 02: disable receive, enable transmit, network-management messages; not a cluster warning. | 16; FLE02_L, FLE02_R, FLE_L, FLE_R … | [FLE02_L.json](decrypted/FLE02_L.json), line 280 |
| `CC_02_03` | CommunicationControl 28 02 03: disable receive, enable transmit, both message types; not a cluster warning. | 16; FLE02_L, FLE02_R, FLE_L, FLE_R … | [FLE02_L.json](decrypted/FLE02_L.json), line 291 |
| `CC_03_01` | CommunicationControl 28 03 01: disable receive/transmit, normal messages; not a cluster warning. | 16; FLE02_L, FLE02_R, FLE_L, FLE_R … | [FLE02_L.json](decrypted/FLE02_L.json), line 302 |
| `CC_03_02` | CommunicationControl 28 03 02: disable receive/transmit, network-management messages; not a cluster warning. | 16; FLE02_L, FLE02_R, FLE_L, FLE_R … | [FLE02_L.json](decrypted/FLE02_L.json), line 313 |
| `CC_03_03` | CommunicationControl 28 03 03: disable receive/transmit, both message types; not a cluster warning. | 16; FLE02_L, FLE02_R, FLE_L, FLE_R … | [FLE02_L.json](decrypted/FLE02_L.json), line 324 |
| `COMMUNICATION_OFF` | CommunicationControl 28 02 01: disable receive, enable transmit of normal messages. | 46; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 693 |
| `COMMUNICATION_ON` | CommunicationControl 28 00 03: enable receive/transmit of normal + network-management messages. | 46; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 682 |
| `CORNERING_LEFT` | Cornering light — left; exact output depends on ECU. | 5; BDC, BDC_G05, BDC_G11, FEM_20 … | [FEM_20.json](decrypted/FEM_20.json), line 519 |
| `CORNERING_RIGHT` | Cornering light — right; exact output depends on ECU. | 5; BDC, BDC_G05, BDC_G11, FEM_20 … | [FEM_20.json](decrypted/FEM_20.json), line 532 |
| `DAYTIME` | Daytime running light; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 454 |
| `DAYTIME_LEFT` | Daytime running light — left; exact output depends on ECU. | 8; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 28 |
| `DAYTIME_RIGHT` | Daytime running light — right; exact output depends on ECU. | 8; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 39 |
| `DIAGNOSE_MODE_OFF` | End diagnostic mode / return to default session; legacy frames differ. | 51; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 672 |
| `DIAGNOSE_MODE_ON` | Enter diagnostic mode; modern mappings select extended session. | 51; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 662 |
| `DIMMED_58G` | Terminal 58g dimmed illumination output. | 4; FRM3, FRM_70, FRM_87, LM_AHL_2 | [FRM3.json](decrypted/FRM3.json), line 369 |
| `DOOR_HANDLE` | Door-handle illumination; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 270 |
| `FOG_FRONT` | Front fog lamp; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 506 |
| `FOG_FRONT_LEFT` | Front fog lamp — left; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 116 |
| `FOG_FRONT_RIGHT` | Front fog lamp — right; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 127 |
| `FOG_REAR` | Rear fog lamp; exact output depends on ECU. | 7; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 571 |
| `FOG_REAR_LEFT` | Rear fog lamp — left; exact output depends on ECU. | 19; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 356 |
| `FOG_REAR_RIGHT` | Rear fog lamp — right; exact output depends on ECU. | 19; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 370 |
| `FOLLOW_ME_HOME` | Follow-me-home lighting function. | 2; BCP_SP21, BDC_G05 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 803 |
| `FOOT_WELL_DOOR_FRONT` | Footwell/door illumination — front; exact output depends on ECU. | 6; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 248 |
| `FOOT_WELL_DOOR_REAR` | Footwell/door illumination — rear; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 259 |
| `GOODBYE_LIGHT` | Goodbye lighting function. | 2; BCP_SP21, BDC_G05 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 907 |
| `GROUP_10_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 150 |
| `GROUP_10_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 150 |
| `GROUP_10_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 150 |
| `GROUP_10_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 150 |
| `GROUP_11_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 166 |
| `GROUP_11_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 166 |
| `GROUP_11_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 166 |
| `GROUP_11_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 166 |
| `GROUP_12_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 182 |
| `GROUP_12_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 182 |
| `GROUP_12_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 182 |
| `GROUP_12_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 182 |
| `GROUP_13_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 198 |
| `GROUP_13_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 198 |
| `GROUP_13_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 198 |
| `GROUP_13_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 198 |
| `GROUP_14_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 214 |
| `GROUP_14_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 214 |
| `GROUP_14_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 214 |
| `GROUP_14_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 214 |
| `GROUP_15_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 230 |
| `GROUP_15_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 230 |
| `GROUP_15_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 230 |
| `GROUP_15_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 230 |
| `GROUP_16_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 246 |
| `GROUP_16_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 246 |
| `GROUP_16_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 246 |
| `GROUP_16_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 246 |
| `GROUP_1_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 6 |
| `GROUP_1_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 6 |
| `GROUP_1_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 6 |
| `GROUP_1_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 6 |
| `GROUP_2_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 22 |
| `GROUP_2_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 22 |
| `GROUP_2_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 22 |
| `GROUP_2_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 22 |
| `GROUP_3_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 38 |
| `GROUP_3_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 38 |
| `GROUP_3_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 38 |
| `GROUP_3_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 38 |
| `GROUP_4_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 54 |
| `GROUP_4_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 54 |
| `GROUP_4_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 54 |
| `GROUP_4_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 54 |
| `GROUP_5_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 70 |
| `GROUP_5_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 70 |
| `GROUP_5_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 70 |
| `GROUP_5_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 70 |
| `GROUP_6_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 86 |
| `GROUP_6_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 86 |
| `GROUP_6_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 86 |
| `GROUP_6_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 86 |
| `GROUP_7_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 102 |
| `GROUP_7_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 102 |
| `GROUP_7_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 102 |
| `GROUP_7_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 102 |
| `GROUP_8_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 118 |
| `GROUP_8_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 118 |
| `GROUP_8_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 118 |
| `GROUP_8_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 118 |
| `GROUP_9_LEFT_1_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1L | [RLM2_1L.json](decrypted/RLM2_1L.json), line 134 |
| `GROUP_9_LEFT_2_LEFT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2L | [RLM2_2L.json](decrypted/RLM2_2L.json), line 134 |
| `GROUP_9_RIGHT_1_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_1R | [RLM2_1R.json](decrypted/RLM2_1R.json), line 134 |
| `GROUP_9_RIGHT_2_RIGHT` | ECU-specific rear-light group; physical LED assignment unknown. | 1; RLM2_2R | [RLM2_2R.json](decrypted/RLM2_2R.json), line 134 |
| `HAZARD` | Hazard-warning light function. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 623 |
| `HIGH_BEAM` | High-beam light; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 467 |
| `HIGH_BEAM_LEFT` | High-beam light — left; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 72 |
| `HIGH_BEAM_RIGHT` | High-beam light — right; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 83 |
| `ILLUMINATED_GRILLE` | Illuminated grille; exact output depends on ECU. | 1; BDC_G11 | [BDC_G11.json](decrypted/BDC_G11.json), line 895 |
| `INDICATOR_FRONT_LEFT` | Front direction indicator — left; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 138 |
| `INDICATOR_FRONT_LEFT_2` | Front direction indicator — left 2; exact output depends on ECU. | 6; FRM3, LCM_IV, LM_60, LM_AHL … | [FRM3.json](decrypted/FRM3.json), line 468 |
| `INDICATOR_FRONT_RIGHT` | Front direction indicator — right; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 149 |
| `INDICATOR_FRONT_RIGHT_2` | Front direction indicator — right 2; exact output depends on ECU. | 6; FRM3, LCM_IV, LM_60, LM_AHL … | [FRM3.json](decrypted/FRM3.json), line 479 |
| `INDICATOR_LEFT` | Direction-indicator function — left; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 480 |
| `INDICATOR_REAR_LEFT` | Rear direction indicator — left; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 412 |
| `INDICATOR_REAR_RIGHT` | Rear direction indicator — right; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 426 |
| `INDICATOR_RIGHT` | Direction-indicator function — right; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 493 |
| `INDICATOR_SIDE_LEFT` | Side direction indicator — left; exact output depends on ECU. | 11; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 160 |
| `INDICATOR_SIDE_RIGHT` | Side direction indicator — right; exact output depends on ECU. | 11; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 171 |
| `INTERIOR` | Interior illumination; exact output depends on ECU. | 7; BCP_SP21, BDC, BDC_G11, FEM_20 … | [FEM_20.json](decrypted/FEM_20.json), line 636 |
| `INTERIOR_2` | Second mapped interior-light output; exact location depends on ECU. | 1; FRM3 | [FRM3.json](decrypted/FRM3.json), line 116 |
| `INVALID` | Invalid-value sentinel; not a user light feature. | 3; BDC, BDC_G11, FEM_20 | [FEM_20.json](decrypted/FEM_20.json), line 649 |
| `KOMBI_OFF` | Disable instrument-cluster feedback/telltale used by light actions. | 5; KOMB01, KOMB25, KOMBSP18, KOMB_G11 … | [KOMB01.json](decrypted/KOMB01.json), line 42 |
| `KOMBI_ON` | Enable instrument-cluster feedback/telltale used by light actions. | 5; KOMB01, KOMB25, KOMBSP18, KOMB_G11 … | [KOMB01.json](decrypted/KOMB01.json), line 26 |
| `LCI_0` | ECU-specific LCI selector 0; physical meaning unknown. | 4; BDC, BDC_G05, BDC_G11, FEM_20 | [FEM_20.json](decrypted/FEM_20.json), line 215 |
| `LCI_1` | ECU-specific LCI selector 1; physical meaning unknown. | 4; BDC, BDC_G05, BDC_G11, FEM_20 | [FEM_20.json](decrypted/FEM_20.json), line 226 |
| `LCI_2` | ECU-specific LCI selector 2; physical meaning unknown. | 4; BDC, BDC_G05, BDC_G11, FEM_20 | [FEM_20.json](decrypted/FEM_20.json), line 237 |
| `LCI_7` | ECU-specific LCI selector 7; physical meaning unknown. | 4; BDC, BDC_G05, BDC_G11, FEM_20 | [FEM_20.json](decrypted/FEM_20.json), line 292 |
| `LCI_8` | ECU-specific LCI selector 8; physical meaning unknown. | 4; BDC, BDC_G05, BDC_G11, FEM_20 | [FEM_20.json](decrypted/FEM_20.json), line 303 |
| `LED_10_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 6; FLE02_L, FLM01_L, FLM02X_L, FLM02_L … | [FLE02_L.json](decrypted/FLE02_L.json), line 123 |
| `LED_10_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 6; FLE02_R, FLM01_R, FLM02X_R, FLM02_R … | [FLE02_R.json](decrypted/FLE02_R.json), line 123 |
| `LED_11_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 5; FLM01_L, FLM02X_L, FLM02_L, FLM03_L … | [FLM01_L.json](decrypted/FLM01_L.json), line 136 |
| `LED_11_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 5; FLM01_R, FLM02X_R, FLM02_R, FLM03_R … | [FLM01_R.json](decrypted/FLM01_R.json), line 136 |
| `LED_12_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 4; FLM01_L, FLM02X_L, FLM02_L, FLM2_1_L | [FLM01_L.json](decrypted/FLM01_L.json), line 149 |
| `LED_12_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 4; FLM01_R, FLM02X_R, FLM02_R, FLM2_1_R | [FLM01_R.json](decrypted/FLM01_R.json), line 149 |
| `LED_13_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 1; FLM02_L | [FLM02_L.json](decrypted/FLM02_L.json), line 201 |
| `LED_13_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 1; FLM02_R | [FLM02_R.json](decrypted/FLM02_R.json), line 201 |
| `LED_14_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 1; FLM02_L | [FLM02_L.json](decrypted/FLM02_L.json), line 216 |
| `LED_14_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 1; FLM02_R | [FLM02_R.json](decrypted/FLM02_R.json), line 216 |
| `LED_15_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 1; FLM02_L | [FLM02_L.json](decrypted/FLM02_L.json), line 231 |
| `LED_15_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 1; FLM02_R | [FLM02_R.json](decrypted/FLM02_R.json), line 231 |
| `LED_1_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 8; FLE02_L, FLE_L, FLM01_L, FLM02X_L … | [FLE02_L.json](decrypted/FLE02_L.json), line 6 |
| `LED_1_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 8; FLE02_R, FLE_R, FLM01_R, FLM02X_R … | [FLE02_R.json](decrypted/FLE02_R.json), line 6 |
| `LED_2_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 7; FLE02_L, FLE_L, FLM01_L, FLM02X_L … | [FLE02_L.json](decrypted/FLE02_L.json), line 19 |
| `LED_2_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 7; FLE02_R, FLE_R, FLM01_R, FLM02X_R … | [FLE02_R.json](decrypted/FLE02_R.json), line 19 |
| `LED_3_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 7; FLE02_L, FLE_L, FLM01_L, FLM02X_L … | [FLE02_L.json](decrypted/FLE02_L.json), line 32 |
| `LED_3_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 7; FLE02_R, FLE_R, FLM01_R, FLM02X_R … | [FLE02_R.json](decrypted/FLE02_R.json), line 32 |
| `LED_4_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 8; FLE02_L, FLE_L, FLM01_L, FLM02X_L … | [FLE02_L.json](decrypted/FLE02_L.json), line 45 |
| `LED_4_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 8; FLE02_R, FLE_R, FLM01_R, FLM02X_R … | [FLE02_R.json](decrypted/FLE02_R.json), line 45 |
| `LED_5_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 7; FLE02_L, FLE_L, FLM01_L, FLM02X_L … | [FLE02_L.json](decrypted/FLE02_L.json), line 58 |
| `LED_5_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 7; FLE02_R, FLE_R, FLM01_R, FLM02X_R … | [FLE02_R.json](decrypted/FLE02_R.json), line 58 |
| `LED_6_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 7; FLE02_L, FLE_L, FLM01_L, FLM02X_L … | [FLE02_L.json](decrypted/FLE02_L.json), line 71 |
| `LED_6_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 7; FLE02_R, FLE_R, FLM01_R, FLM02X_R … | [FLE02_R.json](decrypted/FLE02_R.json), line 71 |
| `LED_7_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 7; FLE02_L, FLE_L, FLM01_L, FLM02X_L … | [FLE02_L.json](decrypted/FLE02_L.json), line 84 |
| `LED_7_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 7; FLE02_R, FLE_R, FLM01_R, FLM02X_R … | [FLE02_R.json](decrypted/FLE02_R.json), line 84 |
| `LED_8_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 6; FLE02_L, FLM01_L, FLM02X_L, FLM02_L … | [FLE02_L.json](decrypted/FLE02_L.json), line 97 |
| `LED_8_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 6; FLE02_R, FLM01_R, FLM02X_R, FLM02_R … | [FLE02_R.json](decrypted/FLE02_R.json), line 97 |
| `LED_9_LEFT` | ECU-specific left headlight LED channel; physical assignment unknown. | 5; FLE02_L, FLM01_L, FLM02X_L, FLM02_L … | [FLE02_L.json](decrypted/FLE02_L.json), line 110 |
| `LED_9_RIGHT` | ECU-specific right headlight LED channel; physical assignment unknown. | 5; FLE02_R, FLM01_R, FLM02X_R, FLM02_R … | [FLE02_R.json](decrypted/FLE02_R.json), line 110 |
| `LED_CORONA` | Corona/FLC LED output; exact physical assignment depends on ECU. | 3; BCP_SP21, FRM_87, LM_AHL_2 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 594 |
| `LED_MSA` | Named LED_MSA output; exact indicator/physical assignment unknown. | 1; BCP_SP21 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 552 |
| `LED_SSP` | Named LED_SSP output; exact indicator/physical assignment unknown. | 1; BCP_SP21 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 566 |
| `LED_WARNLIGHT` | Hazard-switch warning LED; exact output depends on ECU. | 4; BCP_SP21, FRM3, FRM_87, LM_AHL_2 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 580 |
| `LICENSE` | License-plate light; exact output depends on ECU. | 12; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 440 |
| `LICENSE_LEFT` | License-plate light — left; exact output depends on ECU. | 9; LCM, LCM_A, LCM_II, LCM_III … | [LCM.json](decrypted/LCM.json), line 236 |
| `LICENSE_RIGHT` | License-plate light — right; exact output depends on ECU. | 9; LCM, LCM_A, LCM_II, LCM_III … | [LCM.json](decrypted/LCM.json), line 246 |
| `LIGHT_CARPET_LEFT` | Light-carpet projection — left; exact output depends on ECU. | 3; BCP_SP21, BDC_G05, BDC_G11 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 454 |
| `LIGHT_CARPET_RIGHT` | Light-carpet projection — right; exact output depends on ECU. | 3; BCP_SP21, BDC_G05, BDC_G11 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 468 |
| `LOCATOR_AND_FUNCTIONAL_LIGHTING` | Locator/functional illumination output; exact location depends on ECU. | 2; BDC_G05, BDC_G11 | [BDC_G05.json](decrypted/BDC_G05.json), line 955 |
| `LOW_BEAM` | Low-beam light; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 441 |
| `LOW_BEAM_LEFT` | Low-beam light — left; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 6 |
| `LOW_BEAM_RIGHT` | Low-beam light — right; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 17 |
| `MANEUVRING_LIGHT` | Maneuvering-light function. | 2; BCP_SP21, BDC_G05 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 829 |
| `NONE` | No lamp selected (Keine Leuchte); selector value, not a light feature. | 3; BDC, BDC_G11, FEM_20 | [FEM_20.json](decrypted/FEM_20.json), line 402 |
| `OVT` | Named OVT light function; abbreviation and physical meaning unknown. | 3; BCP_SP21, BDC_G05, BDC_G11 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 842 |
| `PARK_LEFT` | Parking-light function — left; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 597 |
| `PARK_RIGHT` | Parking-light function — right; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 610 |
| `POSITION` | Position light; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 415 |
| `POSITION_ES` | Standlicht ES position-light function; ES-specific physical behavior unknown. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 428 |
| `POSITION_LEFT` | Position light — left; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 94 |
| `POSITION_LEFT_INNER` | Position light — left inner; exact output depends on ECU. | 3; LM_60, LM_AHL, LM_AHL_2 | [LM_60.json](decrypted/LM_60.json), line 369 |
| `POSITION_LEFT_OUTER` | Position light — left outer; exact output depends on ECU. | 3; LM_60, LM_AHL, LM_AHL_2 | [LM_60.json](decrypted/LM_60.json), line 347 |
| `POSITION_RIGHT` | Position light — right; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 105 |
| `POSITION_RIGHT_INNER` | Position light — right inner; exact output depends on ECU. | 3; LM_60, LM_AHL, LM_AHL_2 | [LM_60.json](decrypted/LM_60.json), line 380 |
| `POSITION_RIGHT_OUTER` | Position light — right outer; exact output depends on ECU. | 3; LM_60, LM_AHL, LM_AHL_2 | [LM_60.json](decrypted/LM_60.json), line 358 |
| `REAR_LED_1_LEFT_1_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1L | [RLM_1L.json](decrypted/RLM_1L.json), line 21 |
| `REAR_LED_1_LEFT_2_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2L | [RLM_2L.json](decrypted/RLM_2L.json), line 21 |
| `REAR_LED_1_RIGHT_1_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1R | [RLM_1R.json](decrypted/RLM_1R.json), line 21 |
| `REAR_LED_1_RIGHT_2_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2R | [RLM_2R.json](decrypted/RLM_2R.json), line 21 |
| `REAR_LED_2_LEFT_1_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1L | [RLM_1L.json](decrypted/RLM_1L.json), line 36 |
| `REAR_LED_2_LEFT_2_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2L | [RLM_2L.json](decrypted/RLM_2L.json), line 36 |
| `REAR_LED_2_RIGHT_1_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1R | [RLM_1R.json](decrypted/RLM_1R.json), line 36 |
| `REAR_LED_2_RIGHT_2_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2R | [RLM_2R.json](decrypted/RLM_2R.json), line 36 |
| `REAR_LED_3_LEFT_1_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1L | [RLM_1L.json](decrypted/RLM_1L.json), line 51 |
| `REAR_LED_3_LEFT_2_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2L | [RLM_2L.json](decrypted/RLM_2L.json), line 51 |
| `REAR_LED_3_RIGHT_1_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1R | [RLM_1R.json](decrypted/RLM_1R.json), line 51 |
| `REAR_LED_3_RIGHT_2_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2R | [RLM_2R.json](decrypted/RLM_2R.json), line 51 |
| `REAR_LED_4_LEFT_1_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1L | [RLM_1L.json](decrypted/RLM_1L.json), line 66 |
| `REAR_LED_4_LEFT_2_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2L | [RLM_2L.json](decrypted/RLM_2L.json), line 66 |
| `REAR_LED_4_RIGHT_1_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1R | [RLM_1R.json](decrypted/RLM_1R.json), line 66 |
| `REAR_LED_4_RIGHT_2_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2R | [RLM_2R.json](decrypted/RLM_2R.json), line 66 |
| `REAR_LED_5_LEFT_1_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1L | [RLM_1L.json](decrypted/RLM_1L.json), line 81 |
| `REAR_LED_5_LEFT_2_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2L | [RLM_2L.json](decrypted/RLM_2L.json), line 81 |
| `REAR_LED_5_RIGHT_1_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1R | [RLM_1R.json](decrypted/RLM_1R.json), line 81 |
| `REAR_LED_5_RIGHT_2_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2R | [RLM_2R.json](decrypted/RLM_2R.json), line 81 |
| `REAR_LED_6_LEFT_1_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1L | [RLM_1L.json](decrypted/RLM_1L.json), line 96 |
| `REAR_LED_6_LEFT_2_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2L | [RLM_2L.json](decrypted/RLM_2L.json), line 96 |
| `REAR_LED_6_RIGHT_1_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1R | [RLM_1R.json](decrypted/RLM_1R.json), line 96 |
| `REAR_LED_6_RIGHT_2_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2R | [RLM_2R.json](decrypted/RLM_2R.json), line 96 |
| `REAR_LED_7_LEFT_1_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1L | [RLM_1L.json](decrypted/RLM_1L.json), line 111 |
| `REAR_LED_7_LEFT_2_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2L | [RLM_2L.json](decrypted/RLM_2L.json), line 111 |
| `REAR_LED_7_RIGHT_1_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1R | [RLM_1R.json](decrypted/RLM_1R.json), line 111 |
| `REAR_LED_7_RIGHT_2_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2R | [RLM_2R.json](decrypted/RLM_2R.json), line 111 |
| `REAR_LED_8_LEFT_1_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1L | [RLM_1L.json](decrypted/RLM_1L.json), line 126 |
| `REAR_LED_8_LEFT_2_LEFT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2L | [RLM_2L.json](decrypted/RLM_2L.json), line 126 |
| `REAR_LED_8_RIGHT_1_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_1R | [RLM_1R.json](decrypted/RLM_1R.json), line 126 |
| `REAR_LED_8_RIGHT_2_RIGHT` | ECU-specific rear LED channel; physical LED assignment unknown. | 1; RLM_2R | [RLM_2R.json](decrypted/RLM_2R.json), line 126 |
| `REAR_LEFT` | Rear running/position light — left; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 118 |
| `REAR_RIGHT` | Rear running/position light — right; exact output depends on ECU. | 21; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 132 |
| `REMOTE_LIGHT` | Remote-light function; exact lamp/pattern behavior depends on ECU. | 2; BCP_SP21, BDC_G05 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 855 |
| `RESET_TO_ECU` | Reset I/O output control to default via RTD=01; not an ECU reboot. | 2; BCP_SP21, BDC_G05 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 953 |
| `RETURN_CONTROL` | Return mapped light outputs to ECU control (raw 2F 45 01 00 FE in listed variants). | 3; BDC, BDC_G11, FEM_20 | [FEM_20.json](decrypted/FEM_20.json), line 704 |
| `REVERSE` | Reverse light; exact output depends on ECU. | 6; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 584 |
| `REVERSE_LEFT` | Reverse light — left; exact output depends on ECU. | 16; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 384 |
| `REVERSE_RIGHT` | Reverse light — right; exact output depends on ECU. | 16; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [BCP_SP21.json](decrypted/BCP_SP21.json), line 398 |
| `REVERSING_FLASH` | Named reversing-flash function; exact lamp/pattern behavior depends on ECU. | 2; BCP_SP21, BDC_G05 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 868 |
| `SIDEMARKER_FRONT` | Side-marker light — front; exact output depends on ECU. | 4; LM_60, LM_AHL, LM_AHL_2, LM_E65_2 | [LM_60.json](decrypted/LM_60.json), line 325 |
| `SIDEMARKER_LEFT` | Side-marker light — left; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 50 |
| `SIDEMARKER_REAR` | Side-marker light — rear; exact output depends on ECU. | 3; LM_60, LM_AHL, LM_E65_2 | [LM_60.json](decrypted/LM_60.json), line 336 |
| `SIDEMARKER_RIGHT` | Side-marker light — right; exact output depends on ECU. | 5; BCP_SP21, BDC, BDC_G05, BDC_G11 … | [FEM_20.json](decrypted/FEM_20.json), line 61 |
| `SPECIAL_FUNCTION_1_LED` | Special-function LED output; exact physical assignment unknown. | 3; BDC, BDC_G05, BDC_G11 | [BDC.json](decrypted/BDC.json), line 578 |
| `SPECIAL_FUNCTION_FLASHING` | Named special flashing function; exact lamp/pattern assignment unknown. | 2; BCP_SP21, BDC_G05 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 881 |
| `STOP_ROUTINE` | Stop the mapped actuator routine (STPR); runtime fields depend on ECU. | 22; FLE02_L, FLE02_R, FLE_L, FLE_R … | [FLE02_L.json](decrypted/FLE02_L.json), line 169 |
| `TWL` | Door warning lamp (Türwarnleuchte). | 1; FRM3 | [FRM3.json](decrypted/FRM3.json), line 424 |
| `WELCOME_LIGHT` | Welcome lighting function. | 4; BCP_SP21, BDC_G05, FRM3, FRM_87 | [BCP_SP21.json](decrypted/BCP_SP21.json), line 894 |

The **empty command string** occurs in mapping rows for unused/inactive or unknown outputs. In particular FRM3 includes an `XX` unknown-lamp placeholder. These are not additional actionable light-feature IDs; see the full catalog for their resource rows.
