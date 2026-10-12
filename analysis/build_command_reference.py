"""Render the observed symbolic command vocabulary without inventing common payloads."""
from pathlib import Path
import collections
import json
import re

ROOT = Path(__file__).resolve().parent
data = json.loads((ROOT / 'command-catalog.json').read_text(encoding='utf8'))
by_command = collections.defaultdict(list)
for mapping in data['commands']:
    by_command[mapping['command']].append(mapping)

SPECIAL = {
    'ALL': 'All outputs/channels exposed by this ECU mapping.',
    'ALL_LEFT': 'All mapped left headlight channels; scope depends on ECU.',
    'ALL_RIGHT': 'All mapped right headlight channels; scope depends on ECU.',
    'ALL_OFF': 'Clear the mapped output mask / all mapped outputs off.',
    'BI_XENON': 'Bi-xenon shutter output, both sides where the mapping specifies L+R.',
    'BIXENON_LEFT': 'Left bi-xenon output; exact shutter/lamp assignment depends on ECU.',
    'BIXENON_RIGHT': 'Right bi-xenon output; exact shutter/lamp assignment depends on ECU.',
    'BUNCH_LIGHT': 'Named BUNCH_LIGHT light function; physical meaning unknown.',
    'OVT': 'Named OVT light function; abbreviation and physical meaning unknown.',
    'TWL': 'Door warning lamp (Türwarnleuchte).',
    'NONE': 'No lamp selected (Keine Leuchte); selector value, not a light feature.',
    'INVALID': 'Invalid-value sentinel; not a user light feature.',
    'DIAGNOSE_MODE_ON': 'Enter diagnostic mode; modern mappings select extended session.',
    'DIAGNOSE_MODE_OFF': 'End diagnostic mode / return to default session; legacy frames differ.',
    'COMMUNICATION_ON': 'CommunicationControl 28 00 03: enable receive/transmit of normal + network-management messages.',
    'COMMUNICATION_OFF': 'CommunicationControl 28 02 01: disable receive, enable transmit of normal messages.',
    'RETURN_CONTROL': 'Return mapped light outputs to ECU control (raw 2F 45 01 00 FE in listed variants).',
    'RESET_TO_ECU': 'Reset I/O output control to default via RTD=01; not an ECU reboot.',
    'STOP_ROUTINE': 'Stop the mapped actuator routine (STPR); runtime fields depend on ECU.',
    'KOMBI_ON': 'Enable instrument-cluster feedback/telltale used by light actions.',
    'KOMBI_OFF': 'Disable instrument-cluster feedback/telltale used by light actions.',
    'DIMMED_58G': 'Terminal 58g dimmed illumination output.',
    'LED_MSA': 'Named LED_MSA output; exact indicator/physical assignment unknown.',
    'LED_SSP': 'Named LED_SSP output; exact indicator/physical assignment unknown.',
    'LED_CORONA': 'Corona/FLC LED output; exact physical assignment depends on ECU.',
    'POSITION_ES': 'Standlicht ES position-light function; ES-specific physical behavior unknown.',
    'SPECIAL_FUNCTION_1_LED': 'Special-function LED output; exact physical assignment unknown.',
    'SPECIAL_FUNCTION_FLASHING': 'Named special flashing function; exact lamp/pattern assignment unknown.',
    'ANNOUNCEMENT_INDICATOR_LIGHT': 'Named announcement-indicator light function; exact pattern depends on ECU.',
    'FOLLOW_ME_HOME': 'Follow-me-home lighting function.',
    'GOODBYE_LIGHT': 'Goodbye lighting function.',
    'WELCOME_LIGHT': 'Welcome lighting function.',
    'REMOTE_LIGHT': 'Remote-light function; exact lamp/pattern behavior depends on ECU.',
    'REVERSING_FLASH': 'Named reversing-flash function; exact lamp/pattern behavior depends on ECU.',
    'MANEUVRING_LIGHT': 'Maneuvering-light function.',
    'LOCATOR_AND_FUNCTIONAL_LIGHTING': 'Locator/functional illumination output; exact location depends on ECU.',
    'HAZARD': 'Hazard-warning light function.',
    'BRAKE_FORCE_DISPLAY': 'Brake-force display / emergency-stop-signaling light function.',
    'INTERIOR_2': 'Second mapped interior-light output; exact location depends on ECU.',
    'AMBIENT_1': 'Ambient-light channel 1; exact location depends on ECU.',
    'AMBIENT_2': 'Ambient-light channel 2; exact location depends on ECU.',
}


def meaning(command):
    if command in SPECIAL:
        return SPECIAL[command]
    if command.startswith('LCI_'):
        return 'ECU-specific LCI selector ' + command[4:] + '; physical meaning unknown.'
    cc = re.fullmatch(r'CC_(\d\d)_(\d\d)', command)
    if cc:
        control = {'00': 'enable receive/transmit', '01': 'enable receive, disable transmit',
                   '02': 'disable receive, enable transmit', '03': 'disable receive/transmit'}
        traffic = {'01': 'normal messages', '02': 'network-management messages', '03': 'both message types'}
        a, b = cc.groups()
        return f'CommunicationControl 28 {a} {b}: {control[a]}, {traffic[b]}; not a cluster warning.'
    if command.startswith('GROUP_'):
        return 'ECU-specific rear-light group; physical LED assignment unknown.'
    if command.startswith('REAR_LED_'):
        return 'ECU-specific rear LED channel; physical LED assignment unknown.'
    if re.fullmatch(r'LED_\d+_(LEFT|RIGHT)', command):
        return 'ECU-specific ' + command.rsplit('_', 1)[1].lower() + ' headlight LED channel; physical assignment unknown.'
    if re.fullmatch(r'ALL_(LEFT|RIGHT)_[12]_(LEFT|RIGHT)', command):
        return 'All mapped channels of the identified rear-light module; physical grouping depends on ECU.'
    replacements = {
        'FOOT_WELL_DOOR': 'Footwell/door illumination', 'FOG_FRONT': 'Front fog lamp',
        'FOG_REAR': 'Rear fog lamp', 'INDICATOR_FRONT': 'Front direction indicator',
        'INDICATOR_REAR': 'Rear direction indicator', 'INDICATOR_SIDE': 'Side direction indicator',
        'SIDEMARKER': 'Side-marker light', 'LICENSE': 'License-plate light',
        'LOW_BEAM': 'Low-beam light', 'HIGH_BEAM': 'High-beam light',
        'DAYTIME': 'Daytime running light', 'POSITION': 'Position light',
        'BRAKE_FORCE_DISPLAY': 'Brake-force-display light', 'BRAKE': 'Brake light',
        'REVERSE': 'Reverse light', 'REAR': 'Rear running/position light',
        'PARK': 'Parking-light function', 'CORNERING': 'Cornering light',
        'LIGHT_CARPET': 'Light-carpet projection', 'DOOR_HANDLE': 'Door-handle illumination',
        'ILLUMINATED_GRILLE': 'Illuminated grille', 'BOOTLID': 'Bootlid light output',
        'LED_WARNLIGHT': 'Hazard-switch warning LED', 'INDICATOR': 'Direction-indicator function',
        'AMBIENT': 'Ambient illumination', 'INTERIOR': 'Interior illumination'}
    for prefix, text in replacements.items():
        if command == prefix or command.startswith(prefix + '_'):
            suffix = command[len(prefix):].strip('_').replace('_', ' ').lower()
            return text + (' — ' + suffix if suffix else '') + '; exact output depends on ECU.'
    return command.replace('_', ' ').capitalize() + '; physical assignment is ECU-specific.'


lines = [
    '# BimmerLight symbolic command reference',
    '',
    'This table covers all **255 nonempty distinct command IDs** in the supplied app resources. Meanings come from the English IDs, mapped descriptions and diagnostic schemas. Counts show how many distinct ECU variants contain a mapping; they do not prove support on a particular car, UI availability, or live ECU acceptance. The same ID can require different payloads and channels on different variants.',
    '',
    'Numeric LED/group IDs have ECU-specific physical assignments. `LCI_*`, `OVT` and `BUNCH_LIGHT` are retained without invented expansions. `CC_*` entries are communication-control commands. `INVALID`, `NONE` and the empty command are selector/sentinel values rather than user light features. Standard CommunicationControl byte meanings are corroborated by [udsoncan’s service implementation](https://udsoncan.readthedocs.io/en/latest/_modules/udsoncan/services/CommunicationControl.html); vehicle acceptance remains untested.',
    '',
    'For exact mapping arguments, templates and all ECU variants, use [command-catalog.csv](command-catalog.csv) or [command-catalog.json](command-catalog.json). For assembly examples, reset/release distinctions and limitations, use [command-findings.md](command-findings.md). The source column links to one representative mapping; its line number identifies the command key.',
    '',
    '| Command ID | Meaning | ECU variants (count; examples) | Representative source |',
    '|---|---|---|---|',
]
for command in sorted(x for x in by_command if x):
    rows = by_command[command]
    variants = sorted({x['sgbd'] for x in rows})
    row = next((x for x in rows if x['sgbd'] == 'FEM_20'), rows[0])
    source, number = row['mapping_source'].rsplit(':', 1)
    source = source.removeprefix('analysis/')
    examples = ', '.join(variants[:4]) + (' …' if len(variants) > 4 else '')
    lines.append(f'| `{command}` | {meaning(command)} | {len(variants)}; {examples} | [{Path(source).name}]({source}), line {number} |')
lines += ['', 'The **empty command string** occurs in mapping rows for unused/inactive or unknown outputs. In particular FRM3 includes an `XX` unknown-lamp placeholder. These are not additional actionable light-feature IDs; see the full catalog for their resource rows.', '']
(ROOT / 'COMMAND-REFERENCE.md').write_text('\n'.join(lines), encoding='utf8')
print(f'Wrote {sum(bool(x) for x in by_command)} command-reference entries.')
